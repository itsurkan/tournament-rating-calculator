// Per-player breakdown of WHY a rating changed the way it did — the data
// behind the "rating explainer" dialog and the math block under a filtered
// player's match list. Pure re-derivation from a CalculationResult: every
// number here mirrors calculateRatings/contribution in lib/rating.ts exactly.

import type { CalculationResult, PlayerResult } from "@/lib/rating"

/**
 * Why a single match scored the points it did. Mirrors the branches of
 * `contribution()` one-to-one so the UI can name the rule that fired.
 */
export type MatchReason =
  | "beatClose" // won, gap <= 2            → +2
  | "beatWeaker" // won, gap <= 20          → +1
  | "beatFar" // won, gap > 20              → 0
  | "beatStronger" // won vs higher rating  → round((opp - my + 5) / 3)
  | "beatUnrated" // opponent unrated       → 0
  | "lostClose" // lost, gap <= 2           → -2
  | "lostStronger" // lost, gap <= 20       → -1
  | "lostFar" // lost, gap > 20             → 0
  | "lostWeaker" // lost vs lower rating    → -round((my - opp + 5) / 3)
  | "lostUnrated" // opponent unrated       → 0
  | "unratedSelf" // I am unrated           → 0

export type ExplainedMatch = {
  oppId: string
  oppName: string
  /** Opponent's effective (in-tournament) rating the points were priced from. */
  oppRating: number
  won: boolean
  /** Score from this player's perspective, e.g. "3:1". */
  score: string
  stageName: string
  points: number
  reason: MatchReason
}

export type RatingExplanation = {
  player: PlayerResult
  factor: number
  matches: ExplainedMatch[]
  /** Σ of per-match points. */
  sum: number
  /** Fixed newcomer handicap charged on top of the sum (2 or 0). */
  handicap: number
  /** sum - handicap — the value that actually enters the formula. */
  adjusted: number
  /** min(20, Σ|points|) — the weight this tournament adds. */
  contestWeight: number
  /** weightBefore + contestWeight. */
  closingWeight: number
  /** min(40, closingWeight) — the formula's divisor. */
  divisor: number
  /** factor * adjusted * 10 / divisor, unrounded (0 when closingWeight is 0). */
  deltaExact: number
  /** True when max(0, …) clipped a negative result up to 0. */
  clampedToZero: boolean
  /** True when the player had no weight-bearing games (rating stays 0). */
  zeroWeight: boolean
}

// The reason for a contribution — same branch order as contribution().
function matchReason(my: number, opp: number, won: boolean): MatchReason {
  if (won) {
    if (opp <= 0) return "beatUnrated"
    if (my >= opp) {
      const gap = my - opp
      if (gap <= 2) return "beatClose"
      if (gap <= 20) return "beatWeaker"
      return "beatFar"
    }
    return "beatStronger"
  }
  if (my <= 0) return "unratedSelf"
  if (opp <= 0) return "lostUnrated"
  if (my <= opp) {
    const gap = opp - my
    if (gap <= 2) return "lostClose"
    if (gap <= 20) return "lostStronger"
    return "lostFar"
  }
  return "lostWeaker"
}

/**
 * Rebuild the full "why" for one player from an already-computed result.
 * Returns null when the player is not part of the result.
 */
export function explainPlayer(
  result: CalculationResult,
  playerId: string,
): RatingExplanation | null {
  const player = result.players.find((p) => p.id === playerId)
  if (!player) return null

  const matches: ExplainedMatch[] = []
  for (const m of result.matches) {
    if (m.winnerId !== playerId && m.loserId !== playerId) continue
    const won = m.winnerId === playerId
    const oppRating = won ? m.loserRatingBefore : m.winnerRatingBefore
    // ligas stores score winner-first — flip it for lost matches so it always
    // reads "my games : opponent's games" (same as the matches table).
    const [a, b] = m.score.split(/[:\-]/)
    matches.push({
      oppId: won ? m.loserId : m.winnerId,
      oppName: won ? m.loserName : m.winnerName,
      oppRating,
      won,
      score: won ? m.score : b && a ? `${b.trim()}:${a.trim()}` : m.score,
      stageName: m.stageName,
      points: won ? m.winnerPoints : m.loserPoints,
      reason: matchReason(player.ratingBefore, oppRating, won),
    })
  }

  const sum = matches.reduce((acc, m) => acc + m.points, 0)
  const sumAbs = matches.reduce((acc, m) => acc + Math.abs(m.points), 0)
  const contestWeight = Math.min(20, sumAbs)
  const closingWeight = player.weightBefore + contestWeight
  const divisor = Math.min(40, closingWeight)
  const zeroWeight = Math.round(closingWeight) === 0

  const handicap = player.provisional ? 2 : 0
  const adjusted = sum - handicap
  const deltaExact = zeroWeight
    ? 0
    : (result.factor * adjusted * 10) / divisor
  const rawAfter = player.ratingBefore + deltaExact
  const clampedToZero = !zeroWeight && rawAfter < 0

  return {
    player,
    factor: result.factor,
    matches,
    sum,
    handicap,
    adjusted,
    contestWeight,
    closingWeight,
    divisor,
    deltaExact,
    clampedToZero,
    zeroWeight,
  }
}
