// Browser-side ligas.io client.
//
// On GitHub Pages there is no server, and ligas.io sends no CORS headers, so the
// browser cannot call ligas.io directly. Every request goes through a Cloudflare
// Worker pass-through proxy (NEXT_PUBLIC_PROXY_URL) that forwards `/<path>` to
// `https://ligas.io/api/<path>` and adds CORS headers.
//
// This is a faithful port of the former `app/api/tournament/route.ts`; it returns
// the same TournamentResponse shape so the UI is unchanged.
import type { TournamentResponse } from "@/lib/types"

// Proxy base, e.g. https://tournament-rating-proxy.<sub>.workers.dev (no trailing
// slash, no /api). `${LIGAS}/tournaments/x` -> proxy -> ligas.io/api/tournaments/x
const LIGAS = (process.env.NEXT_PUBLIC_PROXY_URL ?? "").replace(/\/+$/, "")

/** Error codes the UI maps to i18n keys via `error.<code>`. */
export type LigasErrorCode = "no_tournament_id" | "fetch_failed"

export class LigasError extends Error {
  code: LigasErrorCode
  constructor(code: LigasErrorCode) {
    super(code)
    this.code = code
    this.name = "LigasError"
  }
}

// Extract the short tournament id from any ligas.io tournament URL or a raw id.
// e.g. https://ligas.io/tournament/2el6ef/results -> "2el6ef"
function parseTournamentId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/tournament\/([a-z0-9]+)/i)
  if (match) return match[1]
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
  rating: number | null
  weight: number
  processed: boolean
  rankingAlias: string | null
}

// The rating/weight to use as this player's starting point for the tournament.
//   - If THIS tournament is already in the player's history, use the PRE-tournament
//     values ligas used (reproduce its official result).
//   - Otherwise use the player's CURRENT rating (latest history entry's `final`).
async function readSnapshot(
  alias: string,
  rankings: Ranking[],
  pid: string,
  tournamentId: string,
): Promise<Snapshot | null> {
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

  const entryTime = (e: any) => Date.parse(e?.actualDate ?? e?.date ?? "") || 0
  let latest: any = entries[0]
  for (const e of entries) {
    if (entryTime(e) >= entryTime(latest)) latest = e
  }
  return {
    rating: num(latest?.final),
    weight: num(latest?.finalWeight) ?? 0,
    processed: false,
    rankingAlias: latest?._rankingAlias ?? null,
  }
}

export async function fetchTournament(input: string): Promise<TournamentResponse> {
  const id = parseTournamentId(input)
  if (!id) throw new LigasError("no_tournament_id")

  try {
    if (!LIGAS) throw new Error("NEXT_PUBLIC_PROXY_URL is not set")

    const [tournament, gamesRaw, standingRaw] = await Promise.all([
      getJson(`${LIGAS}/tournaments/${id}`),
      getJson(`${LIGAS}/tournaments/${id}/games`),
      getJson(`${LIGAS}/tournaments/${id}/standing`),
    ])

    const orgAlias: string = tournament?.orgAlias ?? "uttf"
    const games = asArray(gamesRaw)
    const standing = asArray(standingRaw)

    const rosterMap = new Map<string, string>()
    for (const row of standing) {
      if (row?.id && row?.name) rosterMap.set(row.id, row.name)
    }
    if (rosterMap.size === 0) {
      for (const g of games) {
        if (g?.participant1) rosterMap.set(g.participant1, g.participant1Name ?? g.participant1)
        if (g?.participant2) rosterMap.set(g.participant2, g.participant2Name ?? g.participant2)
      }
    }

    const playerIds = Array.from(rosterMap.keys())

    const rankings: Ranking[] = asArray(
      await getJson(`${LIGAS}/organizations/${orgAlias}/rankings`).catch(() => []),
    )
      .map((r: any) => ({ shortId: r?.shortId, alias: r?.alias ?? null }))
      .filter((r): r is Ranking => typeof r.shortId === "string")

    const ratings = await Promise.all(
      playerIds.map(async (pid) => {
        try {
          const [profile, snap] = await Promise.all([
            getJson(`${LIGAS}/organizations/${orgAlias}/users/${pid}`).catch(() => null),
            readSnapshot(orgAlias, rankings, pid, id),
          ])
          const rating = snap ? snap.rating : readRanking(profile)
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

    const processed = ratings.some((r) => r.processed)
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

    const matches = games
      .map((g) => {
        const result: string = g?.result ?? ""
        const m = result.match(/^(\d+)\s*:\s*(\d+)$/)
        if (!m) return null
        const s1 = Number(m[1])
        const s2 = Number(m[2])
        if (s1 === s2) return null
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

    return {
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
    }
  } catch (err) {
    if (err instanceof LigasError) throw err
    console.error("tournament fetch error:", (err as Error).message)
    throw new LigasError("fetch_failed")
  }
}
