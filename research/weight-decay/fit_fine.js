const fs = require('fs')
const path = require('path')

const pairs = JSON.parse(fs.readFileSync(path.join(__dirname, 'pairs.json'), 'utf8'))
const crossBoundary = pairs.filter((p) => p.monthBoundariesCrossed > 0)

function applyDecayV1(w, months, a, b, cap, roundMode) {
  // cap applied AFTER decay each step
  let cur = w
  for (let i = 0; i < months; i++) {
    const pct = a + b * cur
    cur = cur * (1 - pct)
    if (cap != null) cur = Math.min(cap, cur)
  }
  return roundMode === 'round' ? Math.round(cur) : roundMode === 'ceil' ? Math.ceil(cur) : Math.floor(cur)
}

function applyDecayV2(w, months, a, b, cap, roundMode) {
  // cap applied to w BEFORE computing pct (i.e., effective weight for pct purposes is capped)
  let cur = w
  for (let i = 0; i < months; i++) {
    const effective = cap != null ? Math.min(cap, cur) : cur
    const pct = a + b * effective
    cur = cur * (1 - pct)
  }
  return roundMode === 'round' ? Math.round(cur) : roundMode === 'ceil' ? Math.ceil(cur) : Math.floor(cur)
}

function score(fn, a, b, cap, roundMode) {
  let errs = []
  let exact = 0
  for (const p of crossBoundary) {
    const pred = fn(p.prevFinalWeight, p.monthBoundariesCrossed, a, b, cap, roundMode)
    const err = pred - p.nextInitialWeight
    errs.push(err)
    if (err === 0) exact++
  }
  const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length
  return { mae, exactPct: (exact / errs.length) * 100 }
}

let best = null
for (const [label, fn] of [['V1(cap-after-decay)', applyDecayV1], ['V2(cap-before-pct)', applyDecayV2]]) {
  for (let a = 0; a <= 0.1; a += 0.0025) {
    for (let b = 0; b <= 0.008; b += 0.00025) {
      for (const cap of [54, 55, 56, 57, 58]) {
        for (const roundMode of ['round', 'ceil', 'floor']) {
          const { mae, exactPct } = score(fn, a, b, cap, roundMode)
          if (!best || mae < best.mae || (mae === best.mae && exactPct > best.exactPct)) {
            best = { label, a: Math.round(a * 10000) / 10000, b: Math.round(b * 100000) / 100000, cap, roundMode, mae, exactPct }
          }
        }
      }
    }
  }
}

console.log('Best fine-grid result:', best)

const fn = best.label.startsWith('V1') ? applyDecayV1 : applyDecayV2
console.log(`\nDetail (${best.label}, a=${best.a}, b=${best.b}, cap=${best.cap}, round=${best.roundMode}):`)
let exactCount = 0
for (const p of crossBoundary) {
  const pred = fn(p.prevFinalWeight, p.monthBoundariesCrossed, best.a, best.b, best.cap, best.roundMode)
  const diff = pred - p.nextInitialWeight
  if (diff === 0) exactCount++
  console.log(
    `  ${p.pid.padEnd(9)} ${p.prevId}->${p.nextId} fw=${p.prevFinalWeight} months=${p.monthBoundariesCrossed} pred=${pred} obs=${p.nextInitialWeight} diff=${diff}`
  )
}
console.log(`\nExact: ${exactCount}/${crossBoundary.length}`)
