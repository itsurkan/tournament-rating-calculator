// Regression: beating a player who arrives WITHOUT a confirmed rating pays 0,
// even when that player earns an опорний inside the same tournament.
//
// Reported on tournament 6xdwtk (Цуркан Іван, 4.5 / weight 49): the explainer
// credited +1 for each of his two wins over a новачок whom the fixed point
// valued at 2.1, so the total came to −4 instead of the official −6.
//
// The опорний valuation is still used for LOSSES (laij93: a rated player drops
// −3 to a 0.6 новачок) — only the win branch is affected.
import { describe, expect, it } from "vitest"
import { calculateRatings, type Match, type PlayerInput } from "../rating"

const players: PlayerInput[] = [
  { id: "tsurkan", name: "Цуркан Іван", rating: 4.5, weight: 49, provisional: false },
  { id: "rudenko", name: "Руденко Ліліана", rating: 2.1, weight: 20, provisional: false },
  { id: "gubanov", name: "Губанов Олександр", rating: 5.1, weight: 30, provisional: false },
  { id: "burtovyi", name: "Буртовий Павло", rating: 2.9, weight: 25, provisional: false },
  // Новачок: no confirmed rating, but beats a 2.1 player here → опорний 2.1.
  { id: "halkin", name: "Галкін Григорій", rating: 0, weight: 0, provisional: true },
  { id: "spilnyi", name: "Спільний Богдан", rating: 0, weight: 0, provisional: true },
  { id: "sapiha", name: "Сапіга Петро", rating: 0, weight: 0, provisional: true },
]

const m = (winnerId: string, loserId: string, score: string, gameId: number): Match => ({
  gameId, stageName: "#1", winnerId, loserId, score,
})

const matches: Match[] = [
  m("tsurkan", "spilnyi", "3:0", 1),
  m("rudenko", "tsurkan", "3:1", 2),
  m("tsurkan", "halkin", "3:0", 3),
  m("gubanov", "tsurkan", "3:1", 4),
  m("tsurkan", "sapiha", "3:0", 5),
  m("burtovyi", "tsurkan", "3:0", 6),
  m("tsurkan", "halkin", "3:0", 7),
  m("halkin", "rudenko", "3:1", 8), // gives Галкін an опорний of 2.1
]

describe("6xdwtk: wins over an unconfirmed (новачок) opponent score 0", () => {
  const result = calculateRatings(players, matches, 1)
  const tsurkan = result.players.find((p) => p.id === "tsurkan")!

  it("Галкін is still valued at his опорний 2.1", () => {
    expect(result.players.find((p) => p.id === "halkin")!.ratingBefore).toBe(2.1)
  })

  it("each win over Галкін scores 0, not +1", () => {
    for (const g of [3, 7]) {
      expect(result.matches.find((x) => x.gameId === g)!.winnerPoints).toBe(0)
    }
  })

  it("losses are still priced at the opponent's опорний", () => {
    // Руденко (2.1, confirmed) and Буртовий (2.9) are weaker → −round((gap+5)/3).
    expect(result.matches.find((x) => x.gameId === 2)!.loserPoints).toBe(-2)
    expect(result.matches.find((x) => x.gameId === 6)!.loserPoints).toBe(-2)
    // Губанов is 0.6 above him → −2.
    expect(result.matches.find((x) => x.gameId === 4)!.loserPoints).toBe(-2)
    // A rated player who loses to the новачок pays for the опорний, not 0.
    expect(result.matches.find((x) => x.gameId === 8)!.loserPoints).toBe(-2)
  })

  it("Цуркан: Σ = −6 → 4.5 − 1.5 = 3.0", () => {
    expect(tsurkan.weightAfter).toBe(49 + 6)
    expect(tsurkan.ratingAfter).toBe(3)
    expect(tsurkan.change).toBe(-1.5)
  })
})
