// TTWRating engine, scaled to the ligas.io 0-15 ranking scale.
//
// The documented TTWRating formula operates on a ~1000-point scale:
//
//   Delta = max(0, 100 - (Rwin - Rlose)) / 10 * KT
//   KT    = max(0.2, round(Ravg / 200) / 10)
//
// where the winner gains `Delta` and the loser loses `Delta / 2`. If the
// winner already outranks the loser by 100+ points, Delta is 0 (no points for
// beating a much weaker opponent).
//
// Ligas/UTTF ratings live on a 0-15 scale instead. To apply the same formula
// faithfully we convert each rating into its 1000-scale equivalent, run the
// standard formula, then convert the resulting delta back to the 0-15 scale.

export const SCALE_MAX = 15
const SCALE_FACTOR = 1000 / SCALE_MAX // 0-15 -> 0-1000

export type PlayerInput = {
  id: string
  name: string
  /** Starting rating on the 0-15 scale. */
  rating: number
  /** True when ligas had no rating for this player (provisional / new). */
  provisional: boolean
}

export type Match = {
  gameId: number | string
  stageName: string
  winnerId: string
  loserId: string
  /** e.g. "3:1" from the winner's perspective. */
  score: string
}

export type MatchDelta = {
  gameId: number | string
  stageName: string
  winnerId: string
  loserId: string
  score: string
  winnerName: string
  loserName: string
  winnerRatingBefore: number
  loserRatingBefore: number
  /** Points the winner gains (0-15 scale). */
  delta: number
}

export type PlayerResult = {
  id: string
  name: string
  provisional: boolean
  ratingBefore: number
  ratingAfter: number
  change: number
  wins: number
  losses: number
}

export type CalculationResult = {
  players: PlayerResult[]
  matches: MatchDelta[]
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Compute the winner's point gain for a single match on the 0-15 scale.
 * Returns the value already converted back to the 0-15 scale.
 */
export function matchDelta(
  winnerRating0to15: number,
  loserRating0to15: number,
): number {
  const rWin = winnerRating0to15 * SCALE_FACTOR
  const rLose = loserRating0to15 * SCALE_FACTOR
  const rAvg = (rWin + rLose) / 2

  const kt = Math.max(0.2, Math.round(rAvg / 200) / 10)
  const base = Math.max(0, 100 - (rWin - rLose)) / 10
  const delta1000 = base * kt

  // Convert the 1000-scale delta back to the 0-15 scale.
  return delta1000 / SCALE_FACTOR
}

/**
 * Apply all matches sequentially and produce per-player before/after ratings
 * plus a per-match breakdown. Matches are processed in the given order so that
 * rating changes compound the way they would over the course of an event.
 */
export function calculateRatings(
  players: PlayerInput[],
  matches: Match[],
): CalculationResult {
  const current = new Map<string, number>()
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()

  for (const p of players) {
    current.set(p.id, p.rating)
    wins.set(p.id, 0)
    losses.set(p.id, 0)
  }

  const matchDeltas: MatchDelta[] = []

  for (const m of matches) {
    const wBefore = current.get(m.winnerId)
    const lBefore = current.get(m.loserId)
    if (wBefore === undefined || lBefore === undefined) continue

    const delta = matchDelta(wBefore, lBefore)

    current.set(m.winnerId, wBefore + delta)
    current.set(m.loserId, Math.max(0, lBefore - delta / 2))

    wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1)
    losses.set(m.loserId, (losses.get(m.loserId) ?? 0) + 1)

    const winner = players.find((p) => p.id === m.winnerId)
    const loser = players.find((p) => p.id === m.loserId)

    matchDeltas.push({
      gameId: m.gameId,
      stageName: m.stageName,
      winnerId: m.winnerId,
      loserId: m.loserId,
      score: m.score,
      winnerName: winner?.name ?? m.winnerId,
      loserName: loser?.name ?? m.loserId,
      winnerRatingBefore: round2(wBefore),
      loserRatingBefore: round2(lBefore),
      delta: round2(delta),
    })
  }

  const results: PlayerResult[] = players.map((p) => {
    const after = current.get(p.id) ?? p.rating
    return {
      id: p.id,
      name: p.name,
      provisional: p.provisional,
      ratingBefore: round2(p.rating),
      ratingAfter: round2(after),
      change: round2(after - p.rating),
      wins: wins.get(p.id) ?? 0,
      losses: losses.get(p.id) ?? 0,
    }
  })

  results.sort((a, b) => b.ratingAfter - a.ratingAfter)

  return { players: results, matches: matchDeltas }
}
