// Refines magProportional(a,b) with a hard cap and ceil/round variants, plus
// fine grid search around a=0.05,b=0.004, to find an exact (or near-exact) rule.
const fs = require('fs')
const path = require('path')

const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json'), 'utf8'))
const crossBoundary = pairs.filter((p) => p.monthBoundariesCrossed > 0)
// only single-boundary pairs for cleanest signal (month-by-month compounding
// adds noise from resync assumptions)
const single = crossBoundary.filter((p) => p.monthBoundariesCrossed === 1)

console.log(`n(cross)=${crossBoundary.length}  n(single-boundary)=${single.length}`)

function applyDecay(w, months, a, b, cap, roundMode) {
  let cur = w
  for (let i = 0; i < months; i++) {
    const pct = a + b * cur
    cur = cur * (1 - pct)
  }
  if (cap != null) cur = Math.min(cap, cur)
  if (roundMode === 'round') return Math.round(cur)
  if (roundMode === 'ceil') return Math.ceil(cur)
  if (roundMode === 'floor') return Math.floor(cur)
  return cur
}

function evalGrid(pairsSet, cap) {
  let best = null
  for (let a = 0.0; a <= 0.2 + 1e-9; a += 0.005) {
    for (let b = 0.0; b <= 0.01 + 1e-9; b += 0.0005) {
      for (const roundMode of ['round', 'ceil', 'floor']) {
        let errs = []
        let exact = 0
        for (const p of pairsSet) {
          const pred = applyDecay(p.prevFinalWeight, p.monthBoundariesCrossed, a, b, cap, roundMode)
          const err = pred - p.nextInitialWeight
          errs.push(err)
          if (err === 0) exact++
        }
        const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length
        const exactPct = (exact / errs.length) * 100
        if (!best || mae < best.mae || (mae === best.mae && exactPct > best.exactPct)) {
          best = { a: Math.round(a * 1000) / 1000, b: Math.round(b * 10000) / 10000, roundMode, mae, exactPct, cap }
        }
      }
    }
  }
  return best
}

for (const cap of [null, 50, 52, 54, 55, 56, 57, 58, 60]) {
  const bestAll = evalGrid(crossBoundary, cap)
  console.log(
    `cap=${cap}  all-pairs best: a=${bestAll.a} b=${bestAll.b} round=${bestAll.roundMode} MAE=${bestAll.mae.toFixed(3)} exact%=${bestAll.exactPct.toFixed(1)}`
  )
}

console.log('\n--- single-boundary only ---')
for (const cap of [null, 50, 52, 54, 55, 56, 57, 58, 60]) {
  const bestSingle = evalGrid(single, cap)
  console.log(
    `cap=${cap}  single-boundary best: a=${bestSingle.a} b=${bestSingle.b} round=${bestSingle.roundMode} MAE=${bestSingle.mae.toFixed(3)} exact%=${bestSingle.exactPct.toFixed(1)}`
  )
}

// Detail dump using best overall found across both scans
const bestOverall = [null, 50, 52, 54, 55, 56, 57, 58, 60]
  .map((cap) => evalGrid(crossBoundary, cap))
  .sort((x, y) => x.mae - y.mae || y.exactPct - x.exactPct)[0]
console.log(`\n=== Best overall: cap=${bestOverall.cap} a=${bestOverall.a} b=${bestOverall.b} round=${bestOverall.roundMode} ===`)
console.log(`MAE=${bestOverall.mae.toFixed(3)} exact%=${bestOverall.exactPct.toFixed(1)}`)
for (const p of crossBoundary) {
  const pred = applyDecay(p.prevFinalWeight, p.monthBoundariesCrossed, bestOverall.a, bestOverall.b, bestOverall.cap, bestOverall.roundMode)
  const diff = pred - p.nextInitialWeight
  console.log(
    `  ${p.pid.padEnd(9)} ${p.prevId}->${p.nextId} fw=${p.prevFinalWeight} months=${p.monthBoundariesCrossed} pred=${pred} obs=${p.nextInitialWeight} diff=${diff}`
  )
}
