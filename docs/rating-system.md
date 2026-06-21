# Ligas / FNTU rating system — rules

This document describes exactly how the rating engine in [`lib/rating.ts`](../lib/rating.ts)
works, and why. It is the Ukrainian **FNTU ("УТТФ")** table-tennis rating used by
[ligas.io](https://ligas.io) — **not** an Elo system and **not** a 0–15 scale.

> The "0–15" (or "0–5") in a tournament's name is only the **eligibility
> category**. Real ratings are unbounded — top players reach 80–90+.

The engine is adapted from the official-adjacent reference
[`sdemchenko/rating`](https://github.com/sdemchenko/rating), with deliberate
corrections (see [Divergence from the reference](#divergence-from-the-reference))
so it matches **current** ligas behaviour.

---

## 1. Two ratings per player

Every player effectively has two numbers:

| | What it is | Used for |
|---|---|---|
| **Confirmed rating** | The rating carried between tournaments (chains: `final[n] ≈ initial[n+1]`). | A *rated* player's starting point. |
| **Опорний (base) rating** | Re-derived **each tournament** from that event's results. | A *provisional* player's starting point, and **the value every opponent sees** (see §4). |

A player is **provisional** when they arrive **unrated** (rating ≤ 0). When a
rated player's rating decays to 0, they flip back to provisional: their weight
resets to 0 and their опорний is re-derived next tournament.

---

## 2. Per-match contribution

Each match yields an integer **contribution**, computed from the **pre-tournament
(effective) ratings** — never compounded match-by-match.

Let `myR` = my rating, `oppR` = opponent rating.

**If I won:**
| Condition | Points |
|---|---|
| `oppR <= 0` (opponent unrated) | **0** |
| I'm ≥ opponent, gap ≤ 2 | **+2** |
| I'm ≥ opponent, gap ≤ 20 | **+1** |
| I'm ≥ opponent, gap > 20 | **0** |
| I beat a stronger player | **round((oppR − myR + 5) / 3)** |

**If I lost:**
| Condition | Points |
|---|---|
| `myR <= 0` (I'm unrated) | **0** |
| `oppR <= 0` (opponent unrated) | **0** |
| I lost to ≥ me, gap ≤ 2 | **−2** |
| I lost to ≥ me, gap ≤ 20 | **−1** |
| I lost to ≥ me, gap > 20 | **0** |
| I lost to a weaker player | **−round((myR − oppR + 5) / 3)** |

**Unrated rule (both directions):** any match against an unrated (≤ 0) player
scores **0** — beating one, losing to one, and being unrated yourself.

---

## 3. Опорний (base rating) derivation

For a **provisional** player, the starting rating is the *опорний*:

```
опорний = min( weakest RATED player you lost to, strongest RATED player you beat )
```

- If you only won → `опорний = strongest you beat`.
- If you have no rated wins → `опорний = 0`.
- **Unrated (≤ 0) opponents are excluded** from both sides. A loss to an
  unrated player must **not** drag the anchor down to 0.

---

## 4. Opponent valuation (the key rule)

When scoring a match, an opponent is valued at their **in-tournament опорний**,
**not** their pre-tournament confirmed rating.

This matters for provisional opponents: a новачок who earns an опорний of 1.1
this tournament counts as **1.1** to everyone who played them — even though their
*confirmed* rating is still 0. A strong player who loses to that новачок is
penalised accordingly.

Because an опорний depends on opponents' ratings, and some opponents are
themselves provisional, the engine resolves all of them together by **iterating
to a fixed point**: rated players are stable anchors, and provisional опорний
values are recomputed until they stop changing.

> Verified against ligas `laij93`: reproducing the official results requires this
> rule (e.g. a 5.3-rated player loses **−3** to a 0.6 opponent there).

---

## 5. Weight

```
contestWeight = min(20, Σ|contribution|)
closingWeight = initialWeight + contestWeight
```

`weight` is "experience" — how many decisive results back a rating. A provisional
player starts at weight 0.

> **Limitation:** weight does **not** simply carry between tournaments — ligas
> decays it over time. This engine does not model that decay, so for an
> *unprocessed* tournament the magnitude of changes can be larger than ligas'
> eventual official numbers.

---

## 6. Rating delta

```
delta       = factor × Σcontribution × 10 / min(40, closingWeight)
ratingAfter = max(0, closingBase + delta)
```

- `closingBase` is **the player's rating for a rated player, but `0` for a
  provisional player** (see §7) — a новачок's rating is built up from 0, not from
  their опорний.
- `delta = 0` if the player is brand-new and earned no weight.
- The `min(40, weight)` divisor is why **newcomers swing hard** (small weight →
  big moves) while **established players move slowly** (weight capped at 40).
- `factor` is the tournament's weighting coefficient (usually 1).
- The displayed **change** is `ratingAfter − опорний`, matching how ligas shows
  it (e.g. a новачок with опорний 1.1 who nets 0 points shows "rating 0 ↓1.1").

---

## 7. Provisional ("новачок") players

A provisional player arrives **unrated** (rating ≤ 0) **or with weight 0**. (The
weight check matters: for an already-processed tournament ligas stores the
новачок's опорний as their `initial` rating — so rating > 0 — but still with
weight 0. They are provisional, not rated.)

The key rule: **a provisional player's rating is built up from 0, not from their
опорний.** The опорний is only the *yardstick* used to price each match (the
`myRating` in §2) and the value opponents see (§4) — it is **not** a credited
rating. So:

```
ratingAfter = max(0, 0 + delta)      // provisional: base 0
```

- **Net ≤ 0 points → final 0.** Example: Руденко in `knajuc` earns +3 (beat a 5.7
  player) and loses −2 / −1, netting **0** → `max(0, 0) = 0`, even though her
  опорний is 1.1. This is exact and matches ligas.
- **Net positive → a positive (estimated) rating.** новачки who post a net-positive
  result eventually "confirm", but ligas assigns the confirmed number via a
  **multi-tournament aggregate** that a single-event calculator can't reproduce
  (e.g. Красношлик: опорний 0.6, ligas final 4.9, our estimate 5.7). So a positive
  provisional `ratingAfter` here is an approximation, not an exact match.

---

## Divergence from the reference

The 2023-era reference does **not** special-case unrated opponents: its base
rating counts a 0-rated loss, and its loss branch penalises losing to a 0-rated
player. **Current ligas** (post-2024 "unrated correction") ignores unrated
opponents entirely. This engine matches current ligas, verified against four
independent facts:

| Fact | Reference | Current ligas / this engine |
|---|---|---|
| `ag9gww` — Руденко's опорний | 0 | **2.3** |
| `1xquom` — Кейс's finalWeight | 22 | **20** |
| `knajuc` — loss to unrated Квасніцький | −3 | **0** |
| `knajuc` — Цуркан's loss to (unrated) Руденко | −3 | **0** |

---

## Verification

A reproduction harness feeds each player's **pre-tournament confirmed rating**
into already-processed tournaments and checks the engine reproduces ligas'
stored опорний / final / weight:

- **Rated players: reproduced exactly** (опорний + final + weight) across
  `laij93` and `1xquom`.
- **Provisional players: опорний + weight reproduced exactly**, and the **final
  too whenever they net ≤ 0 points** (built from 0). Only the *net-positive*
  "confirming" provisional finals differ, by the multi-tournament aggregate
  correction described in §7.

Results are ordered by **rating after**, then by **rating before (опорний)** as a
tiebreaker — so provisional players who all close at 0 are still ranked by what
they earned in the tournament.

---

## Data sources (ligas API)

| Data | Endpoint |
|---|---|
| Tournament meta | `/api/tournaments/{id}` |
| Games | `/api/tournaments/{id}/games` |
| Standing | `/api/tournaments/{id}/standing` |
| Org rankings (men / women) | `/api/organizations/{alias}/rankings` |
| Player rating history | `/api/organizations/{alias}/rankings/{rankingId}/participants/{pid}` |
| Live profile | `/api/organizations/{alias}/users/{pid}` |

Each history entry's `id` is the tournament short id, and carries `initial` /
`final` ratings, `initialWeight` / `finalWeight`, and the tournament `factor`.
If a tournament already appears in a player's history it has been processed — use
its `initial` values; otherwise use the player's current rating (latest `final`)
as a live prediction.
