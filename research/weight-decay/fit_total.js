// Alternative, simpler fit: model decay directly on the TOTAL weight value
// (not per-contribution composition). At each month boundary crossed between
// consecutive tournaments, apply candidate_total = f(prevTotal, monthsElapsed)
// and compare against observed nextInitialWeight. This avoids assumptions
// about how contributions individually age/expire and tests whether ligas
// decays the *aggregate* weight number directly.
//
// Uses pairs.json (built by extract_pairs.js) directly — no need to
// reconstruct composition or handle the `final<=0` reset specially, since
// extract_pairs.js already excludes those pairs.

const fs = require('fs')
const path = require('path')

const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json'), 'utf8'))
const crossBoundary = pairs.filter((p) => p.monthBoundariesCrossed > 0)

console.log(`Fitting on ${crossBoundary.length} cross-boundary pairs\n`)

function evalModel(name, fn, roundMode = 'round') {
  let errors = []
  let exact = 0
  for (const p of crossBoundary) {
    const raw = fn(p.prevFinalWeight, p.monthBoundariesCrossed)
    const pred = roundMode === 'round' ? Math.round(raw) : Math.floor(raw)
    const err = pred - p.nextInitialWeight
    errors.push(err)
    if (err === 0) exact++
  }
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length
  const exactPct = (exact / errors.length) * 100
  return { name, mae, exactPct, n: errors.length }
}

const results = []

// (a) geometric on total: total * r^months
for (let r = 0.5; r <= 0.97 + 1e-9; r += 0.01) {
  const rr = Math.round(r * 100) / 100
  results.push(evalModel(`geometricTotal(r=${rr})`, (w, m) => w * Math.pow(rr, m)))
}

// (b) per-boundary flat percentage subtraction with floor at some min,
// i.e. total decreases by p% each boundary regardless of magnitude — same as (a) really.

// (c) linear subtraction: total - K*months (capped at 0)
for (let K = 1; K <= 30; K++) {
  results.push(evalModel(`linearSub(K=${K})`, (w, m) => Math.max(0, w - K * m)))
}

// (d) proportional-to-sqrt(weight) decay: total - c*sqrt(w)*m
for (let c = 0.5; c <= 5; c += 0.5) {
  results.push(evalModel(`sqrtSub(c=${c})`, (w, m) => Math.max(0, w - c * Math.sqrt(w) * m)))
}

// (e) total * r^months with an additive floor-less min-weight retained portion:
// total = w0 + (w - w0)*r^m  is equivalent to geometric decay toward an asymptote w0
for (const w0 of [0, 5, 10, 15, 20]) {
  for (let r = 0.3; r <= 0.9; r += 0.1) {
    const rr = Math.round(r * 10) / 10
    results.push(evalModel(`geomToward(w0=${w0},r=${rr})`, (w, m) => w0 + (w - w0) * Math.pow(rr, m)))
  }
}

// (f) percentage decay per boundary that itself depends on total magnitude:
// e.g. decay% = a + b*w (higher weight -> higher % drop), single-boundary calibrated
// then applied iteratively per boundary crossed
for (const a of [0.05, 0.1, 0.15, 0.2]) {
  for (const b of [0.001, 0.002, 0.003, 0.004, 0.005]) {
    results.push(
      evalModel(`magProportional(a=${a},b=${b})`, (w, m) => {
        let cur = w
        for (let i = 0; i < m; i++) {
          const pct = Math.min(0.9, a + b * cur)
          cur = cur * (1 - pct)
        }
        return cur
      })
    )
  }
}

results.sort((a, b) => a.mae - b.mae)
console.log('=== Top 20 by MAE ===')
for (const r of results.slice(0, 20)) {
  console.log(`${r.name.padEnd(35)} MAE=${r.mae.toFixed(3)}  exact%=${r.exactPct.toFixed(1)}  n=${r.n}`)
}

console.log('\n=== Top 10 by exact% ===')
const byExact = [...results].sort((a, b) => b.exactPct - a.exactPct)
for (const r of byExact.slice(0, 10)) {
  console.log(`${r.name.padEnd(35)} MAE=${r.mae.toFixed(3)}  exact%=${r.exactPct.toFixed(1)}  n=${r.n}`)
}

// Detail for best-by-MAE
const best = results[0]
console.log(`\n=== Detail for best model: ${best.name} ===`)
const fnMatch = best.name.match(/^(\w+)\(/)[1]
// re-run to get per-pair predictions
function getFn(name) {
  const rMatch = name.match(/r=([\d.]+)/)
  const kMatch = name.match(/K=([\d.]+)/)
  const cMatch = name.match(/c=([\d.]+)/)
  const w0Match = name.match(/w0=([\d.]+)/)
  const aMatch = name.match(/a=([\d.]+)/)
  const bMatch = name.match(/b=([\d.]+)/)
  if (name.startsWith('geometricTotal')) {
    const r = parseFloat(rMatch[1])
    return (w, m) => w * Math.pow(r, m)
  }
  if (name.startsWith('linearSub')) {
    const K = parseFloat(kMatch[1])
    return (w, m) => Math.max(0, w - K * m)
  }
  if (name.startsWith('sqrtSub')) {
    const c = parseFloat(cMatch[1])
    return (w, m) => Math.max(0, w - c * Math.sqrt(w) * m)
  }
  if (name.startsWith('geomToward')) {
    const w0 = parseFloat(w0Match[1])
    const r = parseFloat(rMatch[1])
    return (w, m) => w0 + (w - w0) * Math.pow(r, m)
  }
  if (name.startsWith('magProportional')) {
    const a = parseFloat(aMatch[1])
    const b = parseFloat(bMatch[1])
    return (w, m) => {
      let cur = w
      for (let i = 0; i < m; i++) {
        const pct = Math.min(0.9, a + b * cur)
        cur = cur * (1 - pct)
      }
      return cur
    }
  }
}
const fn = getFn(best.name)
for (const p of crossBoundary) {
  const pred = Math.round(fn(p.prevFinalWeight, p.monthBoundariesCrossed))
  const diff = pred - p.nextInitialWeight
  console.log(
    `  ${p.pid.padEnd(9)} ${p.prevId}->${p.nextId}  fw=${p.prevFinalWeight} months=${p.monthBoundariesCrossed} pred=${pred} obs=${p.nextInitialWeight} diff=${diff}`
  )
}

fs.writeFileSync(path.join(__dirname, 'fit_total_results.json'), JSON.stringify(results, null, 2))
console.log('\nWrote fit_total_results.json')
