import { type NextRequest, NextResponse } from "next/server"
import { decayWeight } from "@/lib/rating"
import {
  type HistoryEntry,
  monthBoundariesBetween,
  parseMatches,
  pickLatestEntry,
} from "@/lib/ligas-history"
import { type CacheConfig, LIGAS_TAGS, readCacheConfig } from "@/lib/cache-config"

const LIGAS = "https://ligas.io/api"

// ligas.io drops part of any request burst with HTTP 503: firing all ~36 player
// lookups of a 12-player tournament at once loses ~11 of them (measured
// 2026-09-10). Those lookups are the players' ratings, so a dropped one used to
// silently turn a 25.4-rated player into a novice. Requests are therefore run
// through a small concurrency gate and retried with backoff on 429 / 5xx /
// network errors.
const MAX_CONCURRENT = 5
const MAX_ATTEMPTS = 4
const RETRY_BASE_MS = 300

// Ligas data is cached by how fast it changes, so a live tournament can be
// recalculated on every load without re-fetching every player:
//
//   - tournament / games / standing change every few minutes while an event is
//     being played and cost 3 requests → always fetched fresh;
//   - a player's ranking history (their rating + weight) only changes when
//     ligas processes a tournament, but costs players × (rankings + 1)
//     requests — the burst that used to trip ligas' 503 throttling → cached in
//     Next's shared data cache (persisted on Vercel across instances) for
//     `playerTtlS`; the org's ranking list is even more static.
//
// The rating model runs over a FIXED pre-tournament snapshot (see lib/rating.ts),
// so recomputing fresh games against a cached snapshot is exactly the official
// calculation — nothing drifts. The only lag left is the flip from "predicted"
// to "official" once ligas processes the event, bounded by `playerTtlS`.
//
// The TTLs live in lib/cache-config.ts (defaults 3 h / 6 h) and can be changed
// at runtime from /admin, which can also purge the tagged entries outright.

let inFlight = 0
const waiters: Array<() => void> = []
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve))
  }
  inFlight++
  try {
    return await fn()
  } finally {
    inFlight--
    waiters.shift()?.()
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class LigasError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
  }
}

const retryable = (status: number | null) => status === null || status === 429 || status >= 500

type GetJsonOpts = {
  allow404?: boolean
  /**
   * Seconds to keep the response in Next's data cache. Omit for always-fresh
   * (`no-store`). Next only stores 200 responses, so a 404 / 5xx never sticks.
   */
  revalidate?: number
  /** Cache tag, so /admin can purge the entry with revalidateTag. */
  tag?: string
}

// Fetch a ligas JSON endpoint. Resolves to null on 404 when `allow404` is set;
// every other failure (after retries) throws, so the caller can't accidentally
// compute a result from missing data.
async function getJson(url: string, opts: GetJsonOpts = {}): Promise<any> {
  const cacheInit: RequestInit =
    opts.revalidate != null
      ? { next: { revalidate: opts.revalidate, tags: opts.tag ? [opts.tag] : undefined } }
      : { cache: "no-store" }
  return withSlot(async () => {
    let lastErr: LigasError | null = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let res: Response
      try {
        res = await fetch(url, { headers: { accept: "application/json" }, ...cacheInit })
      } catch (err) {
        lastErr = new LigasError(`ligas network error for ${url}: ${(err as Error).message}`, null)
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
        continue
      }
      if (res.ok) return res.json()
      if (res.status === 404 && opts.allow404) return null
      lastErr = new LigasError(`ligas ${res.status} for ${url}`, res.status)
      if (!retryable(res.status)) break
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
    }
    throw lastErr ?? new LigasError(`ligas request failed for ${url}`, null)
  })
}

// Extract the short tournament id from any ligas.io tournament URL or a raw id.
// e.g. https://ligas.io/tournament/2el6ef/results -> "2el6ef"
function parseTournamentId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/tournament\/([a-z0-9]+)/i)
  if (match) return match[1]
  // Allow passing a bare id.
  if (/^[a-z0-9]{4,12}$/i.test(trimmed)) return trimmed
  return null
}

function asArray(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}

// The org user profile is an object with a `fields` array of {key, value} pairs.
function readRanking(profile: any): number | null {
  const fields = Array.isArray(profile?.fields) ? profile.fields : []
  const found = fields.find((f: any) => f?.key === "ranking")
  if (!found) return null
  const value = typeof found.value === "number" ? found.value : Number(found.value)
  return Number.isFinite(value) && value > 0 ? value : null
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

type Ranking = { shortId: string; alias: string | null }

type Snapshot = {
  /** Rating to feed the calculator (null = unrated/provisional). */
  rating: number | null
  /** Weight to feed the calculator. */
  weight: number
  /** True if this exact tournament was already processed for the player. */
  processed: boolean
  /** Alias of the ranking the player belongs to (e.g. "men"), for profile links. */
  rankingAlias: string | null
}

// The rating/weight to use as this player's starting point for the tournament.
//
// A player's ranking history holds one entry per rated tournament, keyed by the
// tournament's short id, with both the pre-tournament (`initial`/`initialWeight`)
// and post-tournament (`final`/`finalWeight`) values.
//
//   - If THIS tournament is already in the player's history, ligas has processed
//     it — use the PRE-tournament values it actually used, so we can reproduce
//     ligas' official result instead of double-counting the event.
//   - Otherwise the tournament is unprocessed: use the player's CURRENT rating,
//     i.e. the `final`/`finalWeight` of their most recent history entry (see
//     pickLatestEntry for the same-day tie-break) — with the finalWeight DECAYED
//     once per calendar-month boundary between that entry and the tournament
//     date (ligas applies the same decay before processing; without it
//     predictions drift, e.g. Квасніцький in 4vfczq predicted +0.6 with stale
//     weight 11 vs official +0.7 with decayed 10).
//
// A player absent from a ranking gets an empty list from ligas (HTTP 200), so
// any thrown error here is a real fetch failure and must propagate.
async function readSnapshot(
  alias: string,
  rankings: Ranking[],
  pid: string,
  tournamentId: string,
  tournamentStart: string | null,
  cache: CacheConfig,
): Promise<Snapshot | null> {
  // Keep each entry tagged with the ranking it came from (men / women / ...).
  type Tagged = HistoryEntry & { _rankingAlias: string | null }
  const entries: Tagged[] = []
  await Promise.all(
    rankings.map(async (r) => {
      const hist = asArray(
        await getJson(`${LIGAS}/organizations/${alias}/rankings/${r.shortId}/participants/${pid}`, {
          revalidate: cache.playerTtlS,
          tag: LIGAS_TAGS.player,
        }),
      )
      for (const e of hist) entries.push({ ...e, _rankingAlias: r.alias })
    }),
  )
  if (entries.length === 0) return null

  const own = entries.find((e) => e?.id === tournamentId)
  if (own) {
    return {
      rating: num(own.initial),
      weight: num(own.initialWeight) ?? 0,
      processed: true,
      rankingAlias: own._rankingAlias,
    }
  }

  // Current rating = the most recent history entry's post-tournament value.
  const latest = pickLatestEntry(entries)!
  const boundaries = monthBoundariesBetween(
    latest.actualDate ?? latest.date ?? null,
    tournamentStart,
  )
  return {
    rating: num(latest.final),
    weight: decayWeight(num(latest.finalWeight) ?? 0, boundaries),
    processed: false,
    rankingAlias: latest._rankingAlias ?? null,
  }
}

// GET (not POST) so Vercel's CDN can coalesce simultaneous loads of the same
// tournament. The `id` param accepts a full ligas.io URL or a bare short id.
export async function GET(req: NextRequest) {
  try {
    const id = parseTournamentId(req.nextUrl.searchParams.get("id") ?? "")
    if (!id) {
      return NextResponse.json(
        { code: "no_tournament_id" },
        { status: 400, headers: { "cache-control": "no-store" } },
      )
    }

    const { config: cache } = await readCacheConfig()

    // Live data — always fresh so newly played games show up immediately.
    const [tournament, gamesRaw, standingRaw] = await Promise.all([
      getJson(`${LIGAS}/tournaments/${id}`),
      getJson(`${LIGAS}/tournaments/${id}/games`),
      getJson(`${LIGAS}/tournaments/${id}/standing`),
    ])

    const orgAlias: string = tournament?.orgAlias ?? "uttf"
    const games = asArray(gamesRaw)
    const standing = asArray(standingRaw)

    // Build the unique player roster from the standing.
    const rosterMap = new Map<string, string>()
    for (const row of standing) {
      if (row?.id && row?.name) rosterMap.set(row.id, row.name)
    }
    // Fall back to game participants if standing is empty.
    if (rosterMap.size === 0) {
      for (const g of games) {
        if (g?.participant1) rosterMap.set(g.participant1, g.participant1Name ?? g.participant1)
        if (g?.participant2) rosterMap.set(g.participant2, g.participant2Name ?? g.participant2)
      }
    }

    const playerIds = Array.from(rosterMap.keys())

    // Rankings for this org (e.g. men / women) — used to look up each player's
    // pre-tournament rating/weight and to build their profile link.
    const rankings: Ranking[] = asArray(
      await getJson(`${LIGAS}/organizations/${orgAlias}/rankings`, {
        revalidate: cache.rankingsTtlS,
        tag: LIGAS_TAGS.rankings,
      }),
    )
      .map((r: any) => ({ shortId: r?.shortId, alias: r?.alias ?? null }))
      .filter((r): r is Ranking => typeof r.shortId === "string")

    // For each player, resolve the rating + weight they bring into this
    // tournament: pre-tournament values if ligas already processed it, otherwise
    // their current rating (latest history entry). A lookup that still fails
    // after retries aborts the whole request (→ 502) rather than quietly
    // treating the player as unrated, which would make every result wrong.
    const ratings = await Promise.all(
      playerIds.map(async (pid) => {
        const [profile, snap] = await Promise.all([
          getJson(`${LIGAS}/organizations/${orgAlias}/users/${pid}`, {
            allow404: true,
            revalidate: cache.playerTtlS,
            tag: LIGAS_TAGS.player,
          }),
          readSnapshot(orgAlias, rankings, pid, id, tournament?.start ?? null, cache),
        ])
        // Use the snapshot (pre-tournament `initial` if processed, else the
        // latest history `final`). Fall back to the live profile ranking only
        // when the player has no ranking history at all.
        const rating = snap ? snap.rating : readRanking(profile)
        return {
          id: pid,
          ranking: rating != null && rating > 0 ? rating : null,
          weight: snap?.weight ?? 0,
          processed: snap?.processed ?? false,
          rankingAlias: snap?.rankingAlias ?? null,
        }
      }),
    )

    // A tournament counts as already-processed if ligas has folded it into any
    // player's rating history.
    const processed = ratings.some((r) => r.processed)

    // Fall back to the org's first ranking alias when a player's own ranking is
    // unknown (e.g. a brand-new player with no history yet).
    const fallbackAlias = rankings[0]?.alias ?? null

    const players = playerIds.map((pid) => {
      const r = ratings.find((x) => x.id === pid)
      const rankingAlias = r?.rankingAlias ?? fallbackAlias
      return {
        id: pid,
        name: rosterMap.get(pid) ?? pid,
        ranking: r?.ranking ?? null,
        weight: r?.weight ?? 0,
        provisional: r?.ranking == null,
        profileUrl: rankingAlias
          ? `https://ligas.io/${orgAlias}/ranking/${rankingAlias}/participants/${pid}`
          : null,
      }
    })

    // Played, decided games only — walkovers / byes ("0:0") are not rated.
    const matches = parseMatches(games)

    return NextResponse.json(
      {
        tournament: {
          id,
          name: tournament?.name ?? id,
          orgName: tournament?.orgName ?? null,
          orgAlias,
          location: tournament?.location ?? null,
          start: tournament?.start ?? null,
          format: tournament?.format ?? null,
          processed,
          url: `https://ligas.io/tournament/${id}/results`,
        },
        players,
        matches,
      },
      {
        // Short edge cache: a room full of people refreshing during a live
        // event collapses into one route run per 30 s (served stale for up to
        // another 60 s while it revalidates in the background). Freshness of
        // the player ratings is bounded by `playerTtlS` in the data cache, not
        // here. `max-age=0` keeps the browser itself from caching.
        headers: {
          "cache-control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60",
        },
      },
    )
  } catch (err) {
    console.log("[v0] tournament fetch error:", (err as Error).message)
    return NextResponse.json(
      { code: "fetch_failed" },
      { status: 502, headers: { "cache-control": "no-store" } },
    )
  }
}
