// FNTU / ligas.io ("УТТФ") rating engine.
//
// Based on the official-adjacent calculation used by ligas.io
// (see https://github.com/sdemchenko/rating). It is NOT an Elo/0-15 system —
// the "0-15" in a tournament name is only the eligibility category, while real
// ratings are unbounded (top players reach 80-90+).
//
// DELIBERATE DIVERGENCE FROM THE REFERENCE: the 2023-era reference does NOT
// special-case unrated (rating <= 0) opponents in baseRating or in the loss
// branch — it counts a 0-rated loss and penalizes losing to a 0-rated player.
// Current ligas (post-2024 "unrated correction") ignores unrated opponents
// entirely. We match current ligas, verified against 4 independent facts:
//   - ag9gww: Руденко's опорний is 2.3, not 0 (reference would give 0)
//   - 1xquom: Кейс's finalWeight is 20, not 22 (loss to unrated scores 0)
//   - knajuc: Руденко loses 0 (not -2/-3) to unrated Квасніцький
//   - knajuc: Цуркан loses 0 to (unrated) Руденко
// A player with incoming rating <= 0 is treated as provisional: weight resets
// to 0 and their starting rating is re-derived as the опорний (baseRating).
//
// How it works, per player, over a single tournament:
//
//   1. Each match yields an integer "contribution":
//        - Beat a similar/weaker opponent  -> +2 (gap <= 2), +1 (gap <= 20), else 0
//        - Beat a stronger opponent        -> round((oppR - myR + 5) / 3)
//        - Lost to a stronger opponent      -> -2 (gap <= 2), -1 (gap <= 20), else 0
//        - Lost to a weaker opponent        -> -round((myR - oppR + 5) / 3)
//        - Any match against an unrated (<= 0) player scores 0 — beating one,
//          losing to one, and being unrated yourself all give 0. "Unrated" for
//          the WIN branch means "arrived without a confirmed rating": a новачок
//          who earns an опорний only inside this tournament still pays 0 to
//          whoever beats them. The LOSS branch does use that опорний (losing to
//          a новачок hurts) — see opponentValue().
//      Contributions always use PRE-tournament ratings (a fixed snapshot).
//
//   2. contestWeight = min(20, sum of |contribution|)          (games played, capped)
//      closingWeight = initialWeight + contestWeight
//
//   3. RATED:       ratingAfter = max(0, rating  + factor * Σcontribution * 10 / min(40, weight))
//      PROVISIONAL: ratingAfter = max(0, опорний + factor * (Σcontribution - 2) * 10 / min(40, weight))
//                   (the "- 2" is the новачок two-game handicap; 0 if no weight)
//
// The min(40, weight) divisor is why established players (high weight) move
// slowly while newcomers swing hard.
//
// Provisional players (no rating yet) are anchored to the "опорний" (base)
// rating derived from whom they beat/lost to, then charged a fixed 2-game
// handicap — so a net-positive newcomer can still finish below their опорний.
//
// Verified against ligas tournament 1xquom: reproduces every rated player's
// post-tournament rating exactly.

/** ligas rounds ratings to one decimal place. */
export function roundRating(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Ligas decays a rated player's weight once at every calendar-month boundary
 * (weights never change between tournaments within the same month). The rule
 * was reverse-engineered from 195 consecutive history pairs across 16 players
 * (see research/weight-decay/FINDINGS.md):
 *
 *   w' = round(min(56, w − w² / 225))
 *
 * 90% exact matches, MAE 0.18 on all 51 cross-boundary pairs; reproduces e.g.
 * 11→10 (Квасніцький 4vfczq), 60→44 (Цуркан), 100→56 / 91→54 (Джулай),
 * 36→(2 boundaries)→26 (Возний). Misses are ≤2 at the extremes (w≲9, w≳130).
 * Fresh light weight barely decays (~9%), old heavy weight loses 25–45%.
 *
 * Apply when predicting an UNPROCESSED tournament from a player's latest
 * history entry. Not needed for processed tournaments (ligas' stored initial
 * already includes it). Provisional resets (final ≤ 0 → weight 0) are a
 * separate rule handled by the engine.
 */
export function decayWeight(weight: number, monthBoundaries: number): number {
  let w = weight
  for (let i = 0; i < monthBoundaries; i++) {
    w = Math.round(Math.min(56, w - (w * w) / 225))
  }
  return w
}

export type PlayerInput = {
  id: string
  name: string
  /** Current rating before the tournament. 0 (or null-mapped-to-0) = unrated. */
  rating: number
  /** Current rating "weight" (experience). 0 for a brand-new player. */
  weight: number
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

export type MatchContribution = {
  gameId: number | string
  stageName: string
  winnerId: string
  loserId: string
  winnerName: string
  loserName: string
  score: string
  winnerRatingBefore: number
  loserRatingBefore: number
  /** True when that side arrived without a confirmed pre-tournament rating. */
  winnerUnconfirmed: boolean
  loserUnconfirmed: boolean
  /** Integer points the winner earned from this match (>= 0). */
  winnerPoints: number
  /** Integer points the loser earned from this match (<= 0). */
  loserPoints: number
}

export type PlayerResult = {
  id: string
  name: string
  provisional: boolean
  /** Effective starting rating actually used (base rating for provisional players). */
  ratingBefore: number
  ratingAfter: number
  change: number
  weightBefore: number
  weightAfter: number
  wins: number
  losses: number
}

export type CalculationResult = {
  players: PlayerResult[]
  matches: MatchContribution[]
  factor: number
}

/** Points a player earns from one match, given pre-tournament ratings. */
export function contribution(
  myRating: number,
  opponentRating: number,
  iWon: boolean,
): number {
  if (iWon) {
    if (opponentRating <= 0) return 0 // beating an unrated player gives nothing
    if (myRating >= opponentRating) {
      const gap = myRating - opponentRating
      if (gap <= 2) return 2
      if (gap <= 20) return 1
      return 0 // huge gap, nothing
    }
    // beat a stronger player
    return Math.round((opponentRating - myRating + 5) / 3)
  }
  // lost
  if (myRating <= 0) return 0 // an unrated player loses nothing
  if (opponentRating <= 0) return 0 // losing to an unrated player costs nothing (symmetric with beating one; confirmed by Кейс's finalWeight=20 in 1xquom)
  if (myRating <= opponentRating) {
    const gap = opponentRating - myRating
    if (gap <= 2) return -2
    if (gap <= 20) return -1
    return 0 // huge gap, lose nothing
  }
  // lost to a weaker player
  return -Math.round((myRating - opponentRating + 5) / 3)
}

type PlayerMatch = { opponentRating: number; iWon: boolean }

/**
 * "Опорний рейтинг" — the base rating a provisional (unrated) player is anchored
 * to, derived purely from this tournament's results: bounded above by the
 * strongest player they beat and the weakest player they lost to.
 *
 * Unrated (<= 0) opponents are IGNORED here — they don't anchor the rating.
 * In particular a loss to an unrated player must NOT pin the anchor to 0:
 * verified against ligas tournament ag9gww, where Руденко's "Рейтинг до" is 2.3
 * (= min weakest RATED loss, strongest RATED win), not 0, despite a loss to an
 * unrated opponent. Counting that 0 was a bug that zeroed real provisional
 * ratings. (Also confirmed on 1b5s0t/2uktgv/k0x9k1 and Цуркан's gz3d1k = 1.4.)
 */
function baseRating(matches: PlayerMatch[]): number {
  let maxWon = 0
  let minLost = 0
  let won = false
  let lost = false
  for (const m of matches) {
    if (m.opponentRating <= 0) continue // unrated opponents don't anchor the rating
    if (m.iWon) {
      maxWon = won ? Math.max(m.opponentRating, maxWon) : m.opponentRating
      won = true
    } else {
      minLost = lost ? Math.min(m.opponentRating, minLost) : m.opponentRating
      lost = true
    }
  }
  if (!won) return 0
  return lost ? Math.min(minLost, maxWon) : maxWon
}

/**
 * Compute every player's post-tournament rating from the full match list at
 * once (the calculation is a batch over a fixed pre-tournament snapshot, not a
 * sequential compounding of per-match deltas).
 */
export function calculateRatings(
  players: PlayerInput[],
  matches: Match[],
  factor = 1,
): CalculationResult {
  const byId = new Map(players.map((p) => [p.id, p]))

  // Each player's matches as (opponentId, iWon). Opponent ratings are resolved
  // LATER from effRating, not from a raw snapshot: a provisional opponent must
  // be valued at the опорний they earn THIS tournament, not their (often 0)
  // confirmed rating. Verified against ligas laij93 — opponents are valued at
  // their in-tournament опорний (e.g. Цуркан there loses -3 to a 0.6 player and
  // his official final only reproduces under that rule).
  const perPlayer = new Map<string, { oppId: string; iWon: boolean }[]>()
  const wins = new Map<string, number>()
  const losses = new Map<string, number>()
  for (const p of players) {
    perPlayer.set(p.id, [])
    wins.set(p.id, 0)
    losses.set(p.id, 0)
  }
  for (const m of matches) {
    if (!byId.has(m.winnerId) || !byId.has(m.loserId)) continue
    perPlayer.get(m.winnerId)!.push({ oppId: m.loserId, iWon: true })
    perPlayer.get(m.loserId)!.push({ oppId: m.winnerId, iWon: false })
    wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1)
    losses.set(m.loserId, (losses.get(m.loserId) ?? 0) + 1)
  }

  // A player is provisional when they arrive unrated (rating <= 0) OR carry no
  // weight (weight <= 0). The weight check matters for an already-processed
  // tournament: ligas stores a новачок's опорний as their `initial` rating (so
  // rating > 0) but still with weight 0 — they are provisional, not rated.
  // Rated players keep their rating; provisional players are anchored to the
  // опорний derived from this tournament. Since an опорний depends on opponents'
  // ratings — and some opponents are themselves provisional — resolve everyone
  // together by iterating to a fixed point (rated players are stable anchors).
  const isProvisional = (p: PlayerInput) => p.rating <= 0 || p.weight <= 0
  const effRating = new Map<string, number>()
  const effWeight = new Map<string, number>()
  for (const p of players) {
    effRating.set(p.id, isProvisional(p) ? 0 : p.rating)
    effWeight.set(p.id, isProvisional(p) ? 0 : p.weight)
  }
  const matchesFor = (id: string): PlayerMatch[] =>
    perPlayer.get(id)!.map((o) => ({ opponentRating: effRating.get(o.oppId) ?? 0, iWon: o.iWon }))
  for (let iter = 0; iter < 50; iter++) {
    let changed = false
    for (const p of players) {
      if (!isProvisional(p)) continue
      const v = baseRating(matchesFor(p.id))
      if (Math.abs(v - (effRating.get(p.id) ?? 0)) > 1e-9) {
        effRating.set(p.id, v)
        changed = true
      }
    }
    if (!changed) break
  }

  // What an opponent is WORTH in one match. Asymmetric on purpose:
  //
  //   - losing to them prices them at their in-tournament опорний (verified on
  //     laij93: a 5.3 player loses -3 to a 0.6 новачок);
  //   - beating them pays 0 when they arrived with no confirmed rating, even if
  //     they earned an опорний here. Points are only awarded for beating a
  //     player ligas already ranks — the same rule as `oppR <= 0` in
  //     contribution(), applied to the pre-tournament rating rather than to the
  //     опорний we derive for them.
  //
  // A player ligas has already processed as a новачок carries their опорний as
  // a stored rating (> 0, weight 0) and counts as confirmed — required by
  // cnftij, where beating Філіп (0.2, weight 0) officially scores +1.
  const opponentValue = (oppId: string, iWon: boolean): number => {
    const opp = byId.get(oppId)
    if (iWon && opp && opp.rating <= 0) return 0
    return effRating.get(oppId) ?? 0
  }

  const playerResults: PlayerResult[] = players.map((p) => {
    const initialRating = effRating.get(p.id)!
    const initialWeight = effWeight.get(p.id)!

    let sumContribution = 0
    let sumAbs = 0
    for (const o of perPlayer.get(p.id)!) {
      const c = contribution(initialRating, opponentValue(o.oppId, o.iWon), o.iWon)
      sumContribution += c
      sumAbs += Math.abs(c)
    }
    const contestWeight = Math.min(20, sumAbs)
    const closingWeight = initialWeight + contestWeight

    // RATED players move by the standard delta from their rating. PROVISIONAL
    // (новачок) players build from their опорний but are charged a fixed 2-game
    // handicap (the "- 2"): a new player's first results are treated as if two
    // of their games were losses. This is why a net-positive provisional result
    // can still land below the опорний, and the soft clamp at 0 makes a weak
    // result collapse to 0 (subsuming the "Σc ≤ 0 → 0" case) while preserving the
    // rare Σc < 0 / high-опорний rows that ligas still keeps positive.
    //
    // Derived & verified against ligas: reproduces every provisional final exactly
    // across 14 processed tournaments (e.g. Умрілов 9ktbaw опорний 5.4, Σc 3,
    // weight 7 → 6.8; Руденко knajuc 1.1, Σc 0 → 0).
    let ratingAfter: number
    if (Math.round(closingWeight) === 0) {
      ratingAfter = 0 // a provisional player with no weight-bearing games stays 0
    } else if (isProvisional(p)) {
      const adj = sumContribution - 2
      ratingAfter = Math.max(0, initialRating + (factor * adj * 10) / Math.min(40, closingWeight))
    } else {
      ratingAfter = Math.max(0, initialRating + (factor * sumContribution * 10) / Math.min(40, closingWeight))
    }
    const before = roundRating(initialRating)
    const after = roundRating(ratingAfter)

    return {
      id: p.id,
      name: p.name,
      // Badge новачок by how the player was actually treated this tournament,
      // not the raw ligas flag. A player who arrives with a stored опорний
      // (rating > 0) but no weight is still provisional (isProvisional → weight
      // <= 0): they get the -2 handicap and are anchored to the опорній, so the
      // UI must show the Новачок badge for them too. (p.provisional alone is
      // false here because ligas has a ranking row, so the badge never showed.)
      provisional: isProvisional(p),
      ratingBefore: before,
      ratingAfter: after,
      // Change is measured against the опорний, exactly as ligas displays it
      // (опорний → final, e.g. Руденко 0 − 1.1 = −1.1). Derive it from the
      // ROUNDED before/after so the row is always internally consistent
      // (before + change === after). Computing it from the unrounded values can
      // disagree by 0.1 — e.g. 1.8 + delta 1.25 = 3.05: the after rounds up to
      // 3.1, but the unrounded 3.05 − 1.8 rounds down to 1.2 instead of 1.3.
      change: roundRating(after - before),
      weightBefore: initialWeight,
      weightAfter: closingWeight,
      wins: wins.get(p.id) ?? 0,
      losses: losses.get(p.id) ?? 0,
    }
  })

  // Per-match breakdown: the points each side earned, from their own viewpoint.
  const matchContributions: MatchContribution[] = matches
    .filter((m) => byId.has(m.winnerId) && byId.has(m.loserId))
    .map((m) => {
      const wRef = effRating.get(m.winnerId)!
      const lRef = effRating.get(m.loserId)!
      return {
        gameId: m.gameId,
        stageName: m.stageName,
        winnerId: m.winnerId,
        loserId: m.loserId,
        score: m.score,
        winnerName: byId.get(m.winnerId)!.name,
        loserName: byId.get(m.loserId)!.name,
        winnerRatingBefore: roundRating(wRef),
        loserRatingBefore: roundRating(lRef),
        winnerUnconfirmed: byId.get(m.winnerId)!.rating <= 0,
        loserUnconfirmed: byId.get(m.loserId)!.rating <= 0,
        winnerPoints: contribution(wRef, opponentValue(m.loserId, true), true),
        loserPoints: contribution(lRef, opponentValue(m.winnerId, false), false),
      }
    })

  // Order by rating after, then by rating before (опорний) as a tiebreaker —
  // so provisional players who all close at 0 are still ranked by what they
  // earned this tournament.
  playerResults.sort(
    (a, b) => b.ratingAfter - a.ratingAfter || b.ratingBefore - a.ratingBefore,
  )

  return { players: playerResults, matches: matchContributions, factor }
}
