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

**Unconfirmed opponents (asymmetric):** for the **win** branch, "unrated" means
*arrived without a confirmed rating* (`rating ≤ 0` **before** the tournament).
A новачок who earns an опорний only inside this event still pays **0** to
whoever beats them. The **loss** branch does use that опорний — losing to a
новачок hurts (see §4). A player ligas has already processed as a новачок
carries the опорний as a stored rating (> 0, weight 0) and counts as confirmed
— required by `cnftij`, where beating Філіп (0.2, weight 0) officially scores
+1. Regression: `lib/__tests__/rating.unconfirmed-opponent.test.ts` (reported on
`6xdwtk`: two wins over a новачок valued 2.1 gave −4 instead of the official
−6).

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

The rule is **one-directional**: it prices *losses* to a provisional player, not
*wins* over them — see the "unconfirmed opponents" note in §2.

---

## 5. Weight

```
contestWeight = min(20, Σ|contribution|)
closingWeight = initialWeight + contestWeight
```

`weight` is "experience" — how many decisive results back a rating. A provisional
player starts at weight 0.

### Weight decay between tournaments

Weight does **not** simply carry between tournaments — ligas decays it at every
**calendar-month boundary** (within the same month, `initialWeight` always
equals the previous `finalWeight`; 143/144 observed pairs). The rule, reverse-
engineered from 195 consecutive history pairs across 16 players
(`research/weight-decay/FINDINGS.md`):

```
w' = round(min(56, w − w² / 225))      // applied once per month boundary
```

90% exact matches, MAE 0.18 on all 51 cross-boundary pairs. Fresh light weight
barely decays (11 → 10, ~9%), old heavy weight loses 25–45% (100 → 56, 91 → 54).
`decayWeight()` in `lib/rating.ts`; the API route applies it when predicting an
**unprocessed** tournament from a player's latest history entry.

> Concrete case (`4vfczq`, Квасніцький): the pre-decay prediction used his
> previous `finalWeight` 11 → delta 10/16 → **+0.6** (5.9 → 6.5). Ligas decayed
> the weight to **10** at the July boundary → delta 10/15 → official **+0.7**
> (5.9 → **6.6**). With `decayWeight` the live prediction now matches the
> official result. Residual risk: the formula misses by ≤2 weight points at the
> extremes (w ≲ 9, w ≳ 130), which can occasionally shift a displayed change by
> 0.1.

---

## 6. Rating delta

```
RATED:        ratingAfter = max(0, rating  + factor × Σcontribution       × 10 / min(40, weight))
PROVISIONAL:  ratingAfter = max(0, опорний + factor × (Σcontribution − 2)  × 10 / min(40, weight))
```

- Both build from the player's own rating (the **опорний** for a provisional
  player) — *not* from 0.
- The **`− 2`** in the provisional formula is the **новачок two-game handicap**
  (see §7): a newcomer's results are scored as if two of their games were losses.
- `delta = 0` if the player is brand-new and earned no weight (`weight 0`).
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

The key rule: **a provisional player builds from their опорний, but is charged a
fixed two-game handicap** — their `Σcontribution` is reduced by **2** before the
delta, as if two of their games were losses. So a newcomer who nets a *positive*
contribution can still finish *below* their опорний:

```
ratingAfter = max(0, опорний + factor × (Σcontribution − 2) × 10 / min(40, weight))
```

- The **`− 2`** handicap is why net-positive newcomers often land below опорній,
  and the soft clamp `max(0, …)` makes any sufficiently weak result collapse to
  **0** (no separate "Σc ≤ 0 → 0" rule is needed — yet a strong result with a
  single weak loss, e.g. Σc = −1 from a high опорній, can still stay positive).

**Worked examples (all exact vs ligas):**

| player | опорний | Σc | weight | ligas final |
|---|---|---|---|---|
| Умрілов `9ktbaw` | 5.4 | +3 | 7 | `5.4 + (3−2)·10/7` = **6.8** |
| Руденко `knajuc` | 1.1 | 0 | 6 | `max(0, 1.1 + (0−2)·10/6)` = **0** |
| `ag9gww` | 2.3 | +1 | 7 | `2.3 + (1−2)·10/7` = **0.9** |

**Accuracy:** reproduces **every** provisional final exactly across 14 processed
tournaments (79/79), provided the опорній input is itself exact. The only
residual gaps come from the опорній derivation, not this formula: a ±0.1 wobble
when two provisional players anchor off each other (a fixed-point tie), and the
pre-tournament rating source for already-processed events.

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

Regression tests live in `lib/__tests__/` (`pnpm test` — vitest). Each fixture
is an already-processed tournament with ligas' pre-tournament `initial` values
as input and the stored official `final` / `finalWeight` as the expected
output; the engine must reproduce every rated player exactly. Currently
covered: `4vfczq` (all 5 rated players + the +0.6/+0.7 weight-decay case).
Add a fixture per newly verified tournament.

A reproduction harness feeds each player's **pre-tournament confirmed rating**
into already-processed tournaments and checks the engine reproduces ligas'
stored опорний / final / weight:

- **Rated players: reproduced exactly** (опорний + final + weight).
- **Provisional players: reproduced exactly too** — опорний, weight, **and the
  final** (the новачок handicap of §7), across 14 processed tournaments. The only
  residual gaps trace back to the опорний *input*, not the final formula (a ±0.1
  fixed-point tie between two mutually-anchoring provisional players, and the
  pre-tournament rating source for some processed events).

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
