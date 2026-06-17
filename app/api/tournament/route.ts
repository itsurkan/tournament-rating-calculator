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

    // Fetch each player's real 0-15 ranking from the org user profile.
    const ratings = await Promise.all(
      playerIds.map(async (pid) => {
        try {
          const profile = await getJson(`${LIGAS}/organizations/${orgAlias}/users/${pid}`)
          return { id: pid, ranking: readRanking(profile) }
        } catch {
          return { id: pid, ranking: null }
        }
      }),
    )

    const players = playerIds.map((pid) => {
      const r = ratings.find((x) => x.id === pid)
      return {
        id: pid,
        name: rosterMap.get(pid) ?? pid,
        ranking: r?.ranking ?? null,
        provisional: r?.ranking == null,
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
