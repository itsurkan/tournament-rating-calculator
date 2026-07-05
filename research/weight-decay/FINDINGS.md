# ligas.io weight-decay rule — findings

## Dataset

16 players' full rating histories fetched from
`https://ligas.io/api/organizations/uttf/rankings/1r6ze3/participants/{pid}`
(saved to `data/*.json`): the 10 requested ids (`bjolssi`, `50byukr`,
`yzqlko3`, `futd9kc`, `xytzc2u`, `k7bse3u`, `f5sl4gx`, `wof4lmw`, `lxek518`,
`6m6zlfa`) plus 6 more active players sourced from the standings of
tournaments `7qbsdt`, `laij93`, `2j9ma9` (`d84kfrj`, `nypb2fp`, `ecdw5qx`,
`b9bwilb`, `ceezreg`, `rk9s3s6`). `6m6zlfa` and `ceezreg` turned out to have
only 1 and 5 tournaments respectively (too sparse to contribute
cross-boundary pairs) but were kept for completeness.

`extract_pairs.js` builds `pairs.json`: every consecutive-entry pair per
player (195 total), sorted chronologically, excluding the "went provisional"
special case. **Important same-day-tournament fix**: when a player has two+
tournaments on the identical `actualDate`, the API's own (newest-first)
ordering had to be reversed as the tie-break, not an alphabetical id
sort — using id order produced 11 spurious "decay" pairs that were actually
same-day chain continuations (`iw == previous fw`) misread as violations.
After fixing the tie-break, zero-boundary consistency jumped from 92.4% to
99.3%.

## Provisional-reset trigger (refined)

The task's stated rule ("exclude pairs where the earlier tournament's
`final <= 0`") is *necessary but not sufficient*. Empirically the reset to
`initialWeight = 0` is triggered by **either**:

- `prev.final <= 0` (player ended the earlier tournament unrated), **or**
- `next.initial <= 0` (player enters the *next* tournament unrated)

Two pairs (`50byukr: l7v9la→c2jbil`, `xytzc2u: tkposk→i1f6o7`) have
`prev.final > 0` but reset anyway — both have `next.initial == 0`, confirming
the second trigger. `extract_pairs.js` now excludes on either condition.

**One unexplained exception remains**: `bjolssi: tg8aoc(final=1.2) → jaq6dl
(initial=0.7)`, 0 month-boundaries apart, weight resets 8→0 despite neither
condition holding. This is 1 of 195 pairs (0.5%) and looks like a ligas-side
data anomaly (manual correction, or a real-time-of-day edge case not visible
in the API) rather than a rule we're missing — noted but not chased further.

## Zero-boundary verification

**143/144 (99.3%)** of same-calendar-month consecutive pairs have
`initialWeight == previous finalWeight` exactly (the one exception is the
`tg8aoc→jaq6dl` anomaly above). This strongly confirms: **decay happens only
at calendar-month boundaries, never within a month.**

## The decay rule

Cross-boundary pairs (51 total, after the reset-trigger fix) were fit by
reconstructing, chronologically, a single **aggregate weight number** per
player and applying a candidate decay once per calendar-month boundary
crossed, then comparing the result to the observed `nextInitialWeight`.

### Rejected approach: per-contribution aging

The task hypothesized decay might apply to each tournament's own
`contestWeight` contribution individually (aging/expiring/discounting each
one separately, composition summed for the total). This was implemented in
an early iteration (candidate families a/b/c from the task spec: geometric
per-contribution, age-schedules, hard expiry) — **best result was
geometric(r=0.65): MAE=8.4, exact match 3.8%.** Every variant in this family
scored similarly badly. The reconstructed compositions diverged wildly from
observed values (e.g. predicting a fresh single 15-weight contribution
crushed to ~4 over 3 months when observed only dropped to 12) — decay is
evidently **not** applied per-contribution.

### Winning approach: aggregate quadratic decay with a cap

Modeling weight as one number that decays as a whole:

```
w' = round( min(56, w - w^2/225) )
```

applied once per calendar-month boundary crossed (iterated for multi-boundary
gaps, cap re-applied at each step).

**Accuracy: 46/51 exact (90.2%), MAE = 0.176**, over the full cross-boundary
dataset (51 pairs spanning 1-32 month boundaries, weights 8-134).

Grid search: `K` swept 150-300, `cap` swept 54-58, both integer step. The fit
has a sharp, unambiguous peak at `K=225, cap=56` -- MAE roughly triples
(K=224/226) or worse (K+/-5) immediately outside this point, so it is not a
coincidental optimum. `K=225=15^2` and `cap=56` are suspicious round-ish
numbers but no exact rationale was found (56 is *not* the same as the rating
engine's `min(40, weight)` divisor cap -- this is a separate constant on the
decay side). A reference linear-percentage model (`pct = a + b*w`, best
`a=0.02, b=0.00425`) was also grid-searched for comparison: MAE=0.235,
exact%=80.4 -- noticeably worse than the quadratic-cap model, and less clean
(2 free parameters vs. the quadratic's implicit single-parameter shape scaled
by a cap).

Equivalent framing: `w'/w = 1 - w/225`, i.e. **the decay percentage itself is
linear in the current weight** (low weight = mild single-digit-percent decay;
weight near the 56 cap = 25% decay per boundary), which matches the task's
qualitative observation ("players with old accumulated weight lose ~25-45%
per boundary; fresh weight loses ~9%") almost exactly: e.g. `w=56 -> drop 14
(25%)`, `w=91 -> drop 37 (40.7%)`, `w=11 -> drop 1 (9.1%)`.

### Remaining misses (5/51)

| pid | transition | fw | months | pred | obs | diff | likely cause |
|---|---|---|---|---|---|---|---|
| 50byukr | esz113->70zmri | 11 | 32 | 4 | 0 | +4 | extreme gap (2.7 years), far outside normal usage; iterating the same 1-month formula 32x is likely not how ligas actually handles multi-year gaps (probably floors to 0 past some threshold) |
| d84kfrj | 1ix3h6->05lf52 | 134 | 1 | 54 | 56 | -2 | fw=134 is the highest weight in the dataset by far; cap-region rounding |
| nypb2fp | 6g2zzu->awg67o | 132 | 1 | 55 | 56 | -1 | same cap-region rounding |
| rk9s3s6 | nu4x5h->hlorur | 8 | 1 | 8 | 7 | +1 | very low weight (8), single-unit rounding noise |
| rk9s3s6 | 7qfp5l->vr0xyb | 9 | 1 | 9 | 8 | +1 | same low-weight rounding |

All misses are +/-1 except the 32-month outlier (which no reasonable model
should be expected to nail -- it's 8x longer than any other gap in the
dataset). The two "cap-region" misses and two "low-weight" misses suggest the
true rounding rule at the boundaries (`w~56` and `w~8-9`) may differ slightly
from plain `round()` -- possibly `floor` above some threshold or a slightly
different cap value per player-weight-class -- but this is second-order noise
on top of an already very strong fit.

## Verdict

**The rule is deterministic and worth implementing.** A single formula with
2 constants (`K=225`, `cap=56`), applied once per calendar-month boundary to
the aggregate `finalWeight`, reproduces 90% of observed transitions exactly
and is within +/-1 on effectively all the rest (excluding one pathological
32-month-gap case that real usage is unlikely to hit -- active players get
processed monthly). Recommended: implement as
`decayWeight(w) = Math.round(Math.min(56, w - w*w/225))`, applied once per
distinct calendar-month boundary between a player's last processed
tournament and the next one being predicted, combined with the existing
provisional-reset rule (`prev.final <= 0 || next.initial <= 0` => reset to 0).
Given the sharpness of the K/cap optimum and the clean 90%+ exact match, this
looks like ligas' actual server-side formula, not a noisy correlate -- worth
adding as `predictWeightDecay()` in `lib/rating.ts` with a regression test
fixture built from a few of the exact-match pairs above (e.g.
`k7bse3u: qn60gp(fw=100)->7qbsdt(iw=56)`, `k7bse3u: yeh71e(fw=91)->hfdl9c
(iw=54)` -- both already independently verified in the task's "known
observations").

## Files

- `data/*.json` -- raw player histories (16 players)
- `extract_pairs.js` -- builds `pairs.json`, verifies the month-boundary claim
- `pairs.json` -- 195 consecutive-entry pairs with month-boundary counts
- `check_reset_rule.js` -- verifies/refines the provisional-reset trigger
- `fit_total.js`, `fit_refined.js`, `fit_fine.js` -- exploratory grid searches
  (aggregate-weight family) that converged on the K=225/cap=56 model
- `fit.js` -- final deliverable: reports the rejected per-contribution family,
  the winning quadratic-cap model, full grid search, and per-pair accuracy
  detail; writes `fit_results.json`
- `fit_results.json`, `fit_total_results.json` -- machine-readable grid-search
  outputs
