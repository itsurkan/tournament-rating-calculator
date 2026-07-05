// Tournament 4vfczq — "Рейтинговий турнір Quiks 0-5", Київ, 2026-07-03.
// PROCESSED by ligas. All inputs below are the PRE-tournament `initial` /
// `initialWeight` values from each player's ligas ranking history entry for
// 4vfczq (endpoint /api/organizations/uttf/rankings/1r6ze3/participants/{pid}),
// fetched 2026-07-05. Expected outputs are ligas' stored official `final` /
// `finalWeight` for the same entry.
import type { Match, PlayerInput } from "../../rating"

export const players: PlayerInput[] = [
  { id: "50byukr", name: "Висоцький Максим", rating: 5.1, weight: 38, provisional: false },
  { id: "k7bse3u", name: "Джулай Олег", rating: 0, weight: 0, provisional: true },
  { id: "fwjl5l7", name: "Черненко Світлана", rating: 0, weight: 0, provisional: true },
  { id: "ceezreg", name: "Стрижак Дмитро", rating: 0, weight: 0, provisional: true },
  { id: "bjolssi", name: "Квасніцький Андрій", rating: 5.9, weight: 10, provisional: false },
  { id: "yzqlko3", name: "Зубков Дмитро", rating: 0.9, weight: 41, provisional: false },
  { id: "6m6zlfa", name: "Федченко Іван", rating: 0, weight: 0, provisional: true },
  { id: "wof4lmw", name: "Спільний Богдан", rating: 0, weight: 0, provisional: true },
  { id: "futd9kc", name: "Цуркан Іван", rating: 3.8, weight: 44, provisional: false },
  { id: "xytzc2u", name: "Возний Дмитро", rating: 1.6, weight: 26, provisional: false },
  { id: "f5sl4gx", name: "Топало Максим", rating: 0, weight: 0, provisional: true },
  { id: "lxek518", name: "Орел Владислав", rating: 0, weight: 0, provisional: true },
]

// From /api/tournaments/4vfczq/games (decided games only, winner-first score).
export const matches: Match[] = [
  { gameId: "g0-1", stageName: "#1", winnerId: "50byukr", loserId: "fwjl5l7", score: "3:2" },
  { gameId: "g0-2", stageName: "#1", winnerId: "k7bse3u", loserId: "ceezreg", score: "3:1" },
  { gameId: "g0-3", stageName: "#1", winnerId: "50byukr", loserId: "ceezreg", score: "3:0" },
  { gameId: "g0-4", stageName: "#1", winnerId: "k7bse3u", loserId: "fwjl5l7", score: "3:0" },
  { gameId: "g0-5", stageName: "#1", winnerId: "50byukr", loserId: "k7bse3u", score: "3:1" },
  { gameId: "g0-6", stageName: "#1", winnerId: "fwjl5l7", loserId: "ceezreg", score: "3:0" },
  { gameId: "g0-7", stageName: "#1", winnerId: "bjolssi", loserId: "6m6zlfa", score: "3:1" },
  { gameId: "g0-8", stageName: "#1", winnerId: "yzqlko3", loserId: "wof4lmw", score: "3:0" },
  { gameId: "g0-9", stageName: "#1", winnerId: "bjolssi", loserId: "wof4lmw", score: "3:1" },
  { gameId: "g0-10", stageName: "#1", winnerId: "yzqlko3", loserId: "6m6zlfa", score: "3:0" },
  { gameId: "g0-11", stageName: "#1", winnerId: "bjolssi", loserId: "yzqlko3", score: "3:0" },
  { gameId: "g0-12", stageName: "#1", winnerId: "6m6zlfa", loserId: "wof4lmw", score: "3:0" },
  { gameId: "g0-13", stageName: "#1", winnerId: "futd9kc", loserId: "f5sl4gx", score: "3:1" },
  { gameId: "g0-14", stageName: "#1", winnerId: "xytzc2u", loserId: "lxek518", score: "3:0" },
  { gameId: "g0-15", stageName: "#1", winnerId: "futd9kc", loserId: "lxek518", score: "3:0" },
  { gameId: "g0-16", stageName: "#1", winnerId: "xytzc2u", loserId: "f5sl4gx", score: "3:0" },
  { gameId: "g0-17", stageName: "#1", winnerId: "futd9kc", loserId: "xytzc2u", score: "3:0" },
  { gameId: "g0-18", stageName: "#1", winnerId: "f5sl4gx", loserId: "lxek518", score: "3:0" },
  { gameId: "g1-1", stageName: "1 фінал", winnerId: "xytzc2u", loserId: "yzqlko3", score: "3:0" },
  { gameId: "g1-2", stageName: "1 фінал", winnerId: "futd9kc", loserId: "k7bse3u", score: "3:1" },
  { gameId: "g1-3", stageName: "1 фінал", winnerId: "xytzc2u", loserId: "50byukr", score: "3:1" },
  { gameId: "g1-4", stageName: "1 фінал", winnerId: "futd9kc", loserId: "bjolssi", score: "3:2" },
  { gameId: "g1-5", stageName: "1 фінал", winnerId: "xytzc2u", loserId: "futd9kc", score: "3:1" },
  { gameId: "g1-6", stageName: "1 фінал", winnerId: "bjolssi", loserId: "50byukr", score: "3:1" },
  { gameId: "g1-7", stageName: "1 фінал", winnerId: "yzqlko3", loserId: "k7bse3u", score: "3:1" },
  { gameId: "g2-1", stageName: "2 фінал", winnerId: "wof4lmw", loserId: "ceezreg", score: "3:0" },
  { gameId: "g2-2", stageName: "2 фінал", winnerId: "fwjl5l7", loserId: "lxek518", score: "3:1" },
  { gameId: "g2-3", stageName: "2 фінал", winnerId: "f5sl4gx", loserId: "wof4lmw", score: "3:1" },
  { gameId: "g2-4", stageName: "2 фінал", winnerId: "6m6zlfa", loserId: "fwjl5l7", score: "3:2" },
  { gameId: "g2-5", stageName: "2 фінал", winnerId: "f5sl4gx", loserId: "6m6zlfa", score: "3:1" },
  { gameId: "g2-6", stageName: "2 фінал", winnerId: "fwjl5l7", loserId: "wof4lmw", score: "3:2" },
  { gameId: "g2-7", stageName: "2 фінал", winnerId: "lxek518", loserId: "ceezreg", score: "3:2" },
]

/** Ligas' official post-tournament values (rated players: exact contract). */
export const officialFinals: Record<
  string,
  { final: number; finalWeight: number }
> = {
  bjolssi: { final: 6.6, finalWeight: 15 },
  "50byukr": { final: 3.9, finalWeight: 43 },
  yzqlko3: { final: 0.2, finalWeight: 44 },
  futd9kc: { final: 4.1, finalWeight: 49 },
  xytzc2u: { final: 3.4, finalWeight: 34 },
}
