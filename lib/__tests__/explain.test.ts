import { describe, expect, it } from "vitest"
import { calculateRatings, type Match, type PlayerInput } from "@/lib/rating"
import { explainPlayer } from "@/lib/explain"

// Real scenario from tournament uen67o (Рейтинговий турнір Quiks 0-25,
// 2026-08-01), verified against ligas' official stored history: Бурдельний
// came in after a 3-year break (weight decayed to 0 → provisional), his
// опорний re-derived to 12, and despite going 3–2 he finished 12 → 10.6
// (change −1.4) because of the newcomer 2-game handicap over a tiny weight.
const players: PlayerInput[] = [
  { id: "burd", name: "Бурдельний", rating: 12, weight: 0, provisional: false },
  { id: "gryn", name: "Гриненко", rating: 16.8, weight: 56, provisional: false },
  { id: "ship", name: "Шипінський", rating: 12.9, weight: 53, provisional: false },
  { id: "mikh", name: "Міхайлян", rating: 4.7, weight: 55, provisional: false },
  { id: "obuk", name: "Обухов", rating: 12, weight: 27, provisional: false },
  { id: "bory", name: "Борисенко", rating: 6.9, weight: 65, provisional: false },
]

const matches: Match[] = [
  { gameId: 1, stageName: "#1", winnerId: "gryn", loserId: "burd", score: "3:1" },
  { gameId: 2, stageName: "#1", winnerId: "burd", loserId: "ship", score: "3:0" },
  { gameId: 3, stageName: "#1", winnerId: "burd", loserId: "mikh", score: "3:1" },
  { gameId: 4, stageName: "1 фінал", winnerId: "obuk", loserId: "burd", score: "3:0" },
  { gameId: 5, stageName: "1 фінал", winnerId: "burd", loserId: "bory", score: "3:1" },
]

describe("explainPlayer", () => {
  const result = calculateRatings(players, matches, 1)

  it("reconstructs the provisional handicap math for Бурдельний (uen67o)", () => {
    const exp = explainPlayer(result, "burd")!
    expect(exp).not.toBeNull()

    // Опорний re-derived to 12 = min(weakest rated loss 12, strongest win 12.9).
    expect(exp.player.provisional).toBe(true)
    expect(exp.player.ratingBefore).toBe(12)

    // Per-match points and the rule that produced each.
    const byOpp = Object.fromEntries(exp.matches.map((m) => [m.oppId, m]))
    expect(byOpp.gryn).toMatchObject({ won: false, points: -1, reason: "lostStronger", score: "1:3" })
    expect(byOpp.ship).toMatchObject({ won: true, points: 2, reason: "beatStronger" })
    expect(byOpp.mikh).toMatchObject({ won: true, points: 1, reason: "beatWeaker" })
    expect(byOpp.obuk).toMatchObject({ won: false, points: -2, reason: "lostClose" })
    expect(byOpp.bory).toMatchObject({ won: true, points: 1, reason: "beatWeaker" })

    // Totals: Σ +1, newcomer handicap −2 → −1 into the formula.
    expect(exp.sum).toBe(1)
    expect(exp.handicap).toBe(2)
    expect(exp.adjusted).toBe(-1)

    // Weight: 0 + min(20, |−1|+2+1+|−2|+1 = 7) = 7; divisor min(40, 7) = 7.
    expect(exp.contestWeight).toBe(7)
    expect(exp.closingWeight).toBe(7)
    expect(exp.divisor).toBe(7)

    // −1 × 10 / 7 = −1.43 → 12 − 1.4 = 10.6, matching ligas' official result.
    expect(exp.deltaExact).toBeCloseTo(-1.4286, 3)
    expect(exp.player.ratingAfter).toBe(10.6)
    expect(exp.player.change).toBe(-1.4)
    expect(exp.clampedToZero).toBe(false)
    expect(exp.zeroWeight).toBe(false)
  })

  it("explains a rated player without a handicap", () => {
    const exp = explainPlayer(result, "gryn")!
    expect(exp.handicap).toBe(0)
    // Beat Бурдельний (valued at his опорний 12): gap 4.8 ≤ 20 → +1.
    expect(exp.matches[0]).toMatchObject({ won: true, points: 1, reason: "beatWeaker" })
    expect(exp.sum).toBe(1)
    expect(exp.adjusted).toBe(1)
    // Weight 56 + 1 = 57, capped at 40 in the divisor.
    expect(exp.closingWeight).toBe(57)
    expect(exp.divisor).toBe(40)
    expect(exp.deltaExact).toBeCloseTo(0.25, 5)
  })

  it("returns null for a player not in the result", () => {
    expect(explainPlayer(result, "nobody")).toBeNull()
  })
})
