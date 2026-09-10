// Tournament cnftij — "06.09.2026 Рейтинговий турнір SpinUp (0-20)", Київ, 2026-09-06.
// PROCESSED by ligas; fetched 2026-09-10. Inputs are each player's pre-tournament
// `initial` / `initialWeight` from their ranking-history entry for cnftij
// (/api/organizations/uttf/rankings/1r6ze3/participants/{pid}); expected outputs
// are the stored official `final` / `finalWeight`. The raw games list is kept
// verbatim (with status 6/7 walkovers) to pin down how walkovers must be parsed.
import type { PlayerInput } from "../../rating"
import type { RawGame } from "../../ligas-history"

export const players: PlayerInput[] = [
  { id: "blg9de7", name: "Лапюк Андрій", rating: 16.1, weight: 52, provisional: false },
  { id: "pj5fn1x", name: "Сліпчук Олег", rating: 9.9, weight: 61, provisional: false },
  { id: "votgah0", name: "Подсухін  Владислав", rating: 8.7, weight: 57, provisional: false },
  { id: "rmyesvx", name: "Галька Олександр", rating: 13.3, weight: 103, provisional: false },
  { id: "n6pm1wb", name: "Абдурашідов Абдурашід", rating: 2.7, weight: 8, provisional: false },
  { id: "h1uc29i", name: "Кузуб Максим", rating: 19.9, weight: 69, provisional: false },
  { id: "9ngxmvu", name: "Філіп Володимир", rating: 0.2, weight: 0, provisional: false },
  { id: "17eo1yx", name: "Максименко Максим", rating: 0.2, weight: 23, provisional: false },
  { id: "qtnzdpc", name: "Маценко  Антон", rating: 0, weight: 0, provisional: true },
]

// /api/tournaments/cnftij/games, verbatim (status 6/7 = walkover, result "0:0").
export const games: RawGame[] = [
  { id: 1, stageName: "Відбірковий", participant1: "pj5fn1x", participant2: "qtnzdpc", result: "3:0", status: 3 },
  { id: 2, stageName: "Відбірковий", participant1: "votgah0", participant2: "17eo1yx", result: "3:0", status: 3 },
  { id: 3, stageName: "Відбірковий", participant1: "rmyesvx", participant2: "9ngxmvu", result: "3:0", status: 3 },
  { id: 4, stageName: "Відбірковий", participant1: "n6pm1wb", participant2: "h1uc29i", result: "0:0", status: 6 },
  { id: 5, stageName: "Відбірковий", participant1: "blg9de7", participant2: "qtnzdpc", result: "3:0", status: 3 },
  { id: 6, stageName: "Відбірковий", participant1: "pj5fn1x", participant2: "9ngxmvu", result: "3:0", status: 3 },
  { id: 7, stageName: "Відбірковий", participant1: "votgah0", participant2: "h1uc29i", result: "3:0", status: 3 },
  { id: 8, stageName: "Відбірковий", participant1: "rmyesvx", participant2: "n6pm1wb", result: "0:0", status: 6 },
  { id: 9, stageName: "Відбірковий", participant1: "17eo1yx", participant2: "blg9de7", result: "0:3", status: 4 },
  { id: 10, stageName: "Відбірковий", participant1: "qtnzdpc", participant2: "9ngxmvu", result: "1:3", status: 4 },
  { id: 11, stageName: "Відбірковий", participant1: "pj5fn1x", participant2: "n6pm1wb", result: "3:0", status: 3 },
  { id: 12, stageName: "Відбірковий", participant1: "votgah0", participant2: "rmyesvx", result: "3:2", status: 3 },
  { id: 13, stageName: "Відбірковий", participant1: "blg9de7", participant2: "9ngxmvu", result: "3:0", status: 3 },
  { id: 14, stageName: "Відбірковий", participant1: "17eo1yx", participant2: "h1uc29i", result: "0:0", status: 6 },
  { id: 15, stageName: "Відбірковий", participant1: "qtnzdpc", participant2: "n6pm1wb", result: "0:0", status: 7 },
  { id: 16, stageName: "Відбірковий", participant1: "pj5fn1x", participant2: "votgah0", result: "3:1", status: 3 },
  { id: 17, stageName: "Відбірковий", participant1: "h1uc29i", participant2: "blg9de7", result: "2:3", status: 4 },
  { id: 18, stageName: "Відбірковий", participant1: "9ngxmvu", participant2: "n6pm1wb", result: "1:3", status: 4 },
  { id: 19, stageName: "Відбірковий", participant1: "17eo1yx", participant2: "rmyesvx", result: "0:3", status: 4 },
  { id: 20, stageName: "Відбірковий", participant1: "qtnzdpc", participant2: "votgah0", result: "0:3", status: 4 },
  { id: 21, stageName: "Відбірковий", participant1: "blg9de7", participant2: "n6pm1wb", result: "3:1", status: 3 },
  { id: 22, stageName: "Відбірковий", participant1: "h1uc29i", participant2: "rmyesvx", result: "3:1", status: 3 },
  { id: 23, stageName: "Відбірковий", participant1: "9ngxmvu", participant2: "votgah0", result: "0:3", status: 4 },
  { id: 24, stageName: "Відбірковий", participant1: "17eo1yx", participant2: "pj5fn1x", result: "0:3", status: 4 },
  { id: 25, stageName: "Відбірковий", participant1: "rmyesvx", participant2: "blg9de7", result: "1:3", status: 4 },
  { id: 26, stageName: "Відбірковий", participant1: "n6pm1wb", participant2: "votgah0", result: "1:2", status: 4 },
  { id: 27, stageName: "Відбірковий", participant1: "h1uc29i", participant2: "pj5fn1x", result: "2:3", status: 4 },
  { id: 28, stageName: "Відбірковий", participant1: "17eo1yx", participant2: "qtnzdpc", result: "3:1", status: 3 },
  { id: 29, stageName: "Відбірковий", participant1: "blg9de7", participant2: "votgah0", result: "3:0", status: 3 },
  { id: 30, stageName: "Відбірковий", participant1: "rmyesvx", participant2: "pj5fn1x", result: "0:3", status: 4 },
  { id: 31, stageName: "Відбірковий", participant1: "h1uc29i", participant2: "qtnzdpc", result: "3:0", status: 3 },
  { id: 32, stageName: "Відбірковий", participant1: "9ngxmvu", participant2: "17eo1yx", result: "3:1", status: 3 },
  { id: 33, stageName: "Відбірковий", participant1: "pj5fn1x", participant2: "blg9de7", result: "1:3", status: 4 },
  { id: 34, stageName: "Відбірковий", participant1: "rmyesvx", participant2: "qtnzdpc", result: "3:0", status: 3 },
  { id: 35, stageName: "Відбірковий", participant1: "n6pm1wb", participant2: "17eo1yx", result: "3:1", status: 3 },
  { id: 36, stageName: "Відбірковий", participant1: "h1uc29i", participant2: "9ngxmvu", result: "3:0", status: 3 },
]

export const officialFinals: Record<string, { final: number; finalWeight: number }> = {
  "blg9de7": { final: 18.4, finalWeight: 61 }, // Лапюк Андрій
  "pj5fn1x": { final: 12.9, finalWeight: 75 }, // Сліпчук Олег
  "votgah0": { final: 10.7, finalWeight: 71 }, // Подсухін  Владислав
  "rmyesvx": { final: 11.8, finalWeight: 113 }, // Галька Олександр
  "n6pm1wb": { final: 1.9, finalWeight: 13 }, // Абдурашідов Абдурашід
  "h1uc29i": { final: 17.2, finalWeight: 84 }, // Кузуб Максим
  "9ngxmvu": { final: 0, finalWeight: 8 }, // Філіп Володимир
  "17eo1yx": { final: 0, finalWeight: 30 }, // Максименко Максим
  "qtnzdpc": { final: 0, finalWeight: 0 }, // Маценко  Антон
}
