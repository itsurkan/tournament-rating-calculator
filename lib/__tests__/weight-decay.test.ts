// Weight decay: w' = round(min(56, w − w²/225)) once per calendar-month
// boundary. Reverse-engineered from 195 ligas history pairs (16 players) —
// see research/weight-decay/FINDINGS.md. Every case below is an OBSERVED
// finalWeight → next initialWeight pair from ligas, so these are regression
// tests against real ligas behaviour, not against our own formula.
import { describe, expect, it } from "vitest"
import { decayWeight } from "../rating"

describe("decayWeight: observed single-boundary pairs", () => {
  const observed: Array<[number, number, string]> = [
    [11, 10, "Квасніцький 7qbsdt→4vfczq (fresh weight, ~9%)"],
    [21, 19, "Цуркан qg1jo4→laij93"],
    [60, 44, "Цуркан zcmy16→4vfczq"],
    [48, 38, "Висоцький 2j9ma9→4vfczq"],
    [53, 41, "Зубков laij93→4vfczq"],
    [54, 41, "Зубков ykb7nb→laij93"],
    [91, 54, "Джулай yeh71e→hfdl9c (old heavy weight, ~40%)"],
    [100, 56, "Джулай qn60gp→7qbsdt (hits the 56 cap)"],
  ]
  for (const [w, expected, label] of observed) {
    it(`${w} → ${expected} (${label})`, () => {
      expect(decayWeight(w, 1)).toBe(expected)
    })
  }
})

describe("decayWeight: multi-boundary and edge cases", () => {
  it("36 → 26 across 2 boundaries (Возний hiyteh 05-17 → 4vfczq 07-03)", () => {
    expect(decayWeight(36, 2)).toBe(26)
  })
  it("0 boundaries → unchanged (same-month: 99.3% of observed pairs)", () => {
    expect(decayWeight(48, 0)).toBe(48)
  })
  it("weight 0 stays 0", () => {
    expect(decayWeight(0, 3)).toBe(0)
  })
})
