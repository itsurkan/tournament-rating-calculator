// Pure helpers for turning raw ligas.io API payloads into engine inputs.
// Kept free of I/O so they can be unit-tested against recorded ligas data.
import type { Match } from "./rating"

/** One row of /organizations/{alias}/rankings/{id}/participants/{pid}. */
export type HistoryEntry = {
  /** Tournament short id. */
  id?: string
  date?: string
  actualDate?: string
  initial?: number
  final?: number
  initialWeight?: number
  finalWeight?: number
  factor?: number
}

const entryTime = (e: HistoryEntry) => Date.parse(e?.actualDate ?? e?.date ?? "") || 0

/**
 * The player's most recent history entry — i.e. the source of their CURRENT
 * rating (`final` / `finalWeight`).
 *
 * Ligas dates entries by tournament day only, so two tournaments played on the
 * same day tie exactly (e.g. Ремез l0140gp on 2026-09-06: xr5spe 5.6/0 → 4.5/9,
 * then h05k35 4.5/9 → 10.2/21 — both `actualDate` 2026-09-06T00:00:00Z). The
 * naive "last one with the max date wins" picked xr5spe and fed 4.5 / weight 9
 * instead of the real 10.2 / 21. Ties are broken by the CHAIN: an entry whose
 * `final`/`finalWeight` is another tied entry's `initial`/`initialWeight` was
 * played first, so it cannot be the latest. Falls back to the API order, which
 * is newest-first.
 */
export function pickLatestEntry<T extends HistoryEntry>(entries: T[]): T | null {
  if (entries.length === 0) return null
  const maxT = Math.max(...entries.map(entryTime))
  const tied = entries.filter((e) => entryTime(e) === maxT)
  const isPredecessor = (e: T) =>
    tied.some((o) => o !== e && o.initial === e.final && o.initialWeight === e.finalWeight)
  return tied.find((e) => !isPredecessor(e)) ?? tied[0]
}

/**
 * Calendar-month boundaries crossed between two ISO dates (UTC). Ligas decays
 * weight once per boundary — see decayWeight in lib/rating.ts.
 */
export function monthBoundariesBetween(fromIso?: string | null, toIso?: string | null): number {
  if (!fromIso || !toIso) return 0
  const a = new Date(fromIso)
  const b = new Date(toIso)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  const diff =
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  return Math.max(0, diff)
}

/** One row of /tournaments/{id}/games. */
export type RawGame = {
  id?: number | string
  stageName?: string
  participant1?: string
  participant2?: string
  /** "p1:p2" sets; walkovers and unplayed games carry "0:0". */
  result?: string
  /** 3/4 = played (p1/p2 won), 6/7 = walkover (p1/p2 awarded), 0 = not played. */
  status?: number
}

/**
 * Decided, actually-played games as directional matches (winner / loser).
 *
 * Walkovers ("технічна перемога", status 6/7, result "0:0" — shown as W / L on
 * the ligas results grid) count for the standing but NOT for the rating:
 * verified against six processed tournaments (61dop0, h05k35, cnftij, eh6hso,
 * be4gog, c762un) — excluding them reproduces all 44 walkover-involved players'
 * official final/finalWeight exactly, while scoring them as wins matches none.
 * Byes and unplayed games (status 0) are "0:0" too and are dropped the same way.
 */
export function parseMatches(games: RawGame[]): Match[] {
  const out: Match[] = []
  for (const g of games) {
    const m = String(g?.result ?? "").match(/^(\d+)\s*:\s*(\d+)$/)
    if (!m) continue
    const s1 = Number(m[1])
    const s2 = Number(m[2])
    if (s1 === s2) continue // 0:0 = walkover / bye / unplayed — not rated
    const p1 = g?.participant1
    const p2 = g?.participant2
    if (!p1 || !p2) continue
    const p1Won = s1 > s2
    out.push({
      gameId: g?.id ?? `${p1}-${p2}`,
      stageName: g?.stageName ?? "",
      winnerId: p1Won ? p1 : p2,
      loserId: p1Won ? p2 : p1,
      score: p1Won ? `${s1}:${s2}` : `${s2}:${s1}`,
    })
  }
  return out
}
