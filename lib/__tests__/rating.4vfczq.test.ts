// Regression: tournament 4vfczq (processed 2026-07-03) must reproduce ligas'
// official finals exactly for every rated player.
//
// This is also the canonical record of the Квасніцький +0.6 vs +0.7 question:
// the official ligas result is 5.9 → 6.6 (+0.7). The earlier live prediction
// of +0.6 used his PREVIOUS tournament's finalWeight (11); ligas then applied
// weight decay and processed the event with initialWeight 10, so the delta is
// 10/15 ≈ 0.67 instead of 10/16 ≈ 0.63. Both are computed by the same engine —
// the inputs differ, not the algorithm. See the companion test below.
import { describe, expect, it } from "vitest"
import { calculateRatings } from "../rating"
import { matches, officialFinals, players } from "./fixtures/4vfczq"

describe("4vfczq (processed): reproduces ligas official results", () => {
  const result = calculateRatings(players, matches, 1)
  const byId = new Map(result.players.map((p) => [p.id, p]))

  for (const [id, official] of Object.entries(officialFinals)) {
    const name = players.find((p) => p.id === id)!.name
    it(`${name}: final ${official.final}, weight ${official.finalWeight}`, () => {
      const r = byId.get(id)!
      expect(r.ratingAfter).toBe(official.final)
      // weightAfter is the closing weight (initialWeight + contestWeight).
      expect(r.weightAfter).toBe(official.finalWeight)
    })
  }

  it("Квасніцький: официальный change is +0.7 (5.9 → 6.6)", () => {
    const k = byId.get("bjolssi")!
    expect(k.ratingBefore).toBe(5.9)
    expect(k.ratingAfter).toBe(6.6)
    expect(k.change).toBe(0.7)
  })

  it("provisional players with no net-positive result close at 0", () => {
    for (const id of ["k7bse3u", "fwjl5l7", "ceezreg", "6m6zlfa", "wof4lmw", "f5sl4gx", "lxek518"]) {
      expect(byId.get(id)!.ratingAfter).toBe(0)
    }
  })
})

describe("4vfczq (pre-processing prediction): weight 11 explains the old +0.6", () => {
  // Before ligas processed 4vfczq, the app fed Квасніцький's CURRENT rating —
  // the final/finalWeight of his previous tournament 7qbsdt: 5.9 / weight 11.
  // Ligas later decayed that weight to 10 before processing. Same engine,
  // different weight snapshot → +0.6 then, +0.7 now. Not a calculation bug.
  it("with previous finalWeight 11 the prediction is 6.5 (+0.6)", () => {
    const predicted = players.map((p) =>
      p.id === "bjolssi" ? { ...p, weight: 11 } : p,
    )
    const result = calculateRatings(predicted, matches, 1)
    const k = result.players.find((p) => p.id === "bjolssi")!
    expect(k.ratingAfter).toBe(6.5)
    expect(k.change).toBe(0.6)
  })
})
