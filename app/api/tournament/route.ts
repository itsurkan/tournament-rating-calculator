import { type NextRequest, NextResponse } from "next/server"

const LIGAS = "https://ligas.io/api"

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

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`ligas ${res.status} for ${url}`)
  return res.json()
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
//   - If THIS tournament is already in the player's history, ligas has already
//     processed it — so we must use the PRE-tournament values, otherwise we'd
//     double-count the very event we're calculating.
//   - Otherwise the tournament is unprocessed and the player's current rating
//     (their latest entry's `final`) is the correct starting point.
async function readSnapshot(
  alias: string,
  rankings: Ranking[],
  pid: string,
  tournamentId: string,
): Promise<Snapshot | null> {
  // Keep each entry tagged with the ranking it came from (men / women / ...).
  const entries: Array<any & { _rankingAlias: string | null }> = []
  await Promise.all(
    rankings.map(async (r) => {
      try {
        const hist = asArray(
          await getJson(`${LIGAS}/organizations/${alias}/rankings/${r.shortId}/participants/${pid}`),
        )
        for (const e of hist) entries.push({ ...e, _rankingAlias: r.alias })
      } catch {
        // player not in this ranking — ignore
      }
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

  let latest: any = null
  let latestT = -Infinity
  for (const e of entries) {
    const t = Date.parse(e?.actualDate ?? e?.date ?? "") || 0
    if (t >= latestT) {
      latestT = t
      latest = e
    }
  }
  return {
    rating: num(latest?.final),
    weight: num(latest?.finalWeight) ?? 0,
    processed: false,
    rankingAlias: latest?._rankingAlias ?? null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = parseTournamentId(String(body?.url ?? ""))
    if (!id) {
      return NextResponse.json(
        { error: "Could not find a tournament id in that URL." },
        { status: 400 },
      )
    }

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
      await getJson(`${LIGAS}/organizations/${orgAlias}/rankings`).catch(() => []),
    )
      .map((r: any) => ({ shortId: r?.shortId, alias: r?.alias ?? null }))
      .filter((r): r is Ranking => typeof r.shortId === "string")

    // For each player, resolve the rating + weight they had going INTO this
    // tournament (pre-tournament if ligas already processed it, current
    // otherwise), falling back to their profile ranking when there's no history.
    const ratings = await Promise.all(
      playerIds.map(async (pid) => {
        try {
          const [profile, snap] = await Promise.all([
            getJson(`${LIGAS}/organizations/${orgAlias}/users/${pid}`).catch(() => null),
            readSnapshot(orgAlias, rankings, pid, id),
          ])
          // If this tournament was already processed, use its pre-tournament
          // `initial`. Otherwise the profile ranking is the authoritative current
          // rating — prefer it over the latest history entry's `final`, which can
          // lag behind the profile (the snapshot's rating is only a fallback).
          const rating = snap?.processed
            ? snap.rating
            : readRanking(profile) ?? snap?.rating ?? null
          return {
            id: pid,
            ranking: rating != null && rating > 0 ? rating : null,
            weight: snap?.weight ?? 0,
            processed: snap?.processed ?? false,
            rankingAlias: snap?.rankingAlias ?? null,
          }
        } catch {
          return { id: pid, ranking: null, weight: 0, processed: false, rankingAlias: null }
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

    // Parse finished games into directional matches (winner / loser).
    // result is "p1:p2"; ignore byes / unplayed / 0:0 entries.
    const matches = games
      .map((g) => {
        const result: string = g?.result ?? ""
        const m = result.match(/^(\d+)\s*:\s*(\d+)$/)
        if (!m) return null
        const s1 = Number(m[1])
        const s2 = Number(m[2])
        if (s1 === s2) return null // not a decided match
        const p1 = g?.participant1
        const p2 = g?.participant2
        if (!p1 || !p2) return null
        const winnerId = s1 > s2 ? p1 : p2
        const loserId = s1 > s2 ? p2 : p1
        const scoreFromWinner = s1 > s2 ? `${s1}:${s2}` : `${s2}:${s1}`
        return {
          gameId: g?.id ?? `${p1}-${p2}`,
          stageName: g?.stageName ?? "",
          winnerId,
          loserId,
          score: scoreFromWinner,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({
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
    })
  } catch (err) {
    console.log("[v0] tournament fetch error:", (err as Error).message)
    return NextResponse.json(
      { error: "Failed to load this tournament from ligas.io." },
      { status: 502 },
    )
  }
}
