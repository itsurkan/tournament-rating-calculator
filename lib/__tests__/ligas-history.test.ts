import { describe, expect, it } from "vitest"
import { monthBoundariesBetween, parseMatches, pickLatestEntry } from "../ligas-history"
import { calculateRatings } from "../rating"
import { games, officialFinals, players } from "./fixtures/cnftij"

describe("pickLatestEntry", () => {
  // Ремез l0140gp, real ligas history (fetched 2026-09-10), API order newest-first.
  // Two tournaments on 2026-09-06 with identical dates; xr5spe (5.6/0 → 4.5/9)
  // fed h05k35 (4.5/9 → 10.2/21), so h05k35 is the latest.
  const remez = [
    { id: "h05k35", date: "2026-09-06T03:00:00Z", actualDate: "2026-09-06T00:00:00Z", initial: 4.5, final: 10.2, initialWeight: 9, finalWeight: 21 },
    { id: "xr5spe", date: "2026-09-06T03:00:00Z", actualDate: "2026-09-06T00:00:00Z", initial: 5.6, final: 4.5, initialWeight: 0, finalWeight: 9 },
    { id: "eh6hso", date: "2026-09-03T03:00:00Z", actualDate: "2026-09-03T00:00:00Z", initial: 1.4, final: 0, initialWeight: 0, finalWeight: 7 },
  ]

  it("breaks a same-day tie by the rating chain, whichever order the API returns", () => {
    expect(pickLatestEntry(remez)?.id).toBe("h05k35")
    expect(pickLatestEntry([...remez].reverse())?.id).toBe("h05k35")
  })

  it("picks the newest date when dates differ", () => {
    expect(pickLatestEntry([remez[2], remez[0]])?.id).toBe("h05k35")
  })

  it("falls back to API order (newest-first) for an unchained tie", () => {
    const a = { id: "a", actualDate: "2026-09-06T00:00:00Z", initial: 1, final: 2, initialWeight: 1, finalWeight: 5 }
    const b = { id: "b", actualDate: "2026-09-06T00:00:00Z", initial: 7, final: 8, initialWeight: 9, finalWeight: 12 }
    expect(pickLatestEntry([a, b])?.id).toBe("a")
  })

  it("returns null for no history", () => {
    expect(pickLatestEntry([])).toBeNull()
  })
})

describe("monthBoundariesBetween", () => {
  it("counts calendar-month boundaries, not 30-day spans", () => {
    expect(monthBoundariesBetween("2026-08-29T00:00:00Z", "2026-09-08T00:00:00Z")).toBe(1)
    expect(monthBoundariesBetween("2026-09-06T00:00:00Z", "2026-09-08T00:00:00Z")).toBe(0)
    expect(monthBoundariesBetween("2026-06-21T00:00:00Z", "2026-09-08T00:00:00Z")).toBe(3)
    expect(monthBoundariesBetween("2026-09-08T00:00:00Z", "2026-08-01T00:00:00Z")).toBe(0)
    expect(monthBoundariesBetween(null, "2026-09-08T00:00:00Z")).toBe(0)
  })
})

describe("parseMatches", () => {
  it("keeps played games with the winner first and drops 0:0 walkovers / byes", () => {
    const parsed = parseMatches(games)
    const played = games.filter((g) => g.status === 3 || g.status === 4)
    expect(parsed).toHaveLength(played.length)
    expect(games.some((g) => g.status === 6 || g.status === 7)).toBe(true)
    for (const m of parsed) {
      const [w, l] = m.score.split(":").map(Number)
      expect(w).toBeGreaterThan(l)
    }
    const p2Win = games.find((g) => g.status === 4)!
    const m = parsed.find((x) => x.gameId === p2Win.id)!
    expect(m.winnerId).toBe(p2Win.participant2)
    expect(m.loserId).toBe(p2Win.participant1)
  })
})

describe("cnftij (processed, 4 walkovers): reproduces ligas official results", () => {
  const result = calculateRatings(players, parseMatches(games), 1)
  const byId = new Map(result.players.map((p) => [p.id, p]))

  for (const [id, official] of Object.entries(officialFinals)) {
    const name = players.find((p) => p.id === id)!.name
    it(`${name}: final ${official.final}, weight ${official.finalWeight}`, () => {
      const r = byId.get(id)!
      expect(r.ratingAfter).toBe(official.final)
      expect(r.weightAfter).toBe(official.finalWeight)
    })
  }

  it("scoring walkovers as wins would break the official results", () => {
    const withWalkovers = [
      ...parseMatches(games),
      ...games
        .filter((g) => g.status === 6 || g.status === 7)
        .map((g) => ({
          gameId: g.id!,
          stageName: g.stageName ?? "",
          winnerId: g.status === 6 ? g.participant1! : g.participant2!,
          loserId: g.status === 6 ? g.participant2! : g.participant1!,
          score: "W",
        })),
    ]
    const wrong = calculateRatings(players, withWalkovers, 1)
    const galka = wrong.players.find((p) => p.id === "rmyesvx")!
    expect(galka.weightAfter).not.toBe(officialFinals.rmyesvx.finalWeight)
  })
})
