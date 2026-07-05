// Builds pairs.json: all consecutive-entry pairs per player (sorted by actualDate
// ascending) where the earlier tournament's `final` > 0 (excludes the "went
// provisional, weight reset to 0" special case).
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const OUT_FILE = path.join(__dirname, 'pairs.json')

function monthsBetween(prevDate, nextDate) {
  // count distinct calendar-month boundaries crossed between prevDate and nextDate
  const p = new Date(prevDate)
  const n = new Date(nextDate)
  const pMonthIndex = p.getUTCFullYear() * 12 + p.getUTCMonth()
  const nMonthIndex = n.getUTCFullYear() * 12 + n.getUTCMonth()
  return nMonthIndex - pMonthIndex
}

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
const pairs = []

for (const file of files) {
  const pid = path.basename(file, '.json')
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))

  // Dedup identical consecutive entries (some players have duplicate rows, e.g. same id twice)
  const seen = new Set()
  const entries = []
  for (const e of raw) {
    const key = `${e.id}|${e.actualDate}|${e.initial}|${e.final}|${e.initialWeight}|${e.finalWeight}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(e)
  }

  // API returns newest-first. For same-actualDate entries (same-day tournaments),
  // the API's own (reverse-chronological) order reflects true processing order,
  // since ligas processes them in some real sequence and chains initialWeight ==
  // previous finalWeight for same-day pairs. So: group by actualDate, and within
  // a date-group preserve the *reverse* of the original (newest-first) API order.
  const dateGroups = new Map()
  raw.forEach((e, originalIdx) => {
    const key = e.actualDate
    if (!dateGroups.has(key)) dateGroups.set(key, [])
  })
  // Build originalIndex lookup (first occurrence in raw, pre-dedup) per entry id+date
  const origIndex = new Map()
  raw.forEach((e, idx) => {
    const key = `${e.id}|${e.actualDate}|${e.initial}|${e.final}|${e.initialWeight}|${e.finalWeight}`
    if (!origIndex.has(key)) origIndex.set(key, idx)
  })

  entries.sort((a, b) => {
    const da = new Date(a.actualDate).getTime()
    const db = new Date(b.actualDate).getTime()
    if (da !== db) return da - db
    // same date: reverse of original raw (newest-first) order => ascending original index reversed
    const keyA = `${a.id}|${a.actualDate}|${a.initial}|${a.final}|${a.initialWeight}|${a.finalWeight}`
    const keyB = `${b.id}|${b.actualDate}|${b.initial}|${b.final}|${b.initialWeight}|${b.finalWeight}`
    return origIndex.get(keyB) - origIndex.get(keyA)
  })

  for (let i = 0; i < entries.length - 1; i++) {
    const prev = entries[i]
    const next = entries[i + 1]

    // Special case: player goes/enters provisional => next initialWeight
    // resets to 0. This is NOT decay. Empirically the trigger is best modeled
    // as "next.initial <= 0" (entering the next tournament unrated) OR
    // "prev.final <= 0" (leaving the previous tournament unrated) — either
    // condition precedes every observed reset except one unexplained anomaly
    // (bjolssi tg8aoc->jaq6dl, noted in FINDINGS.md).
    if (prev.final <= 0 || next.initial <= 0) continue

    const mb = monthsBetween(prev.actualDate, next.actualDate)

    pairs.push({
      pid,
      prevId: prev.id,
      prevDate: prev.actualDate,
      prevFinalWeight: prev.finalWeight,
      prevFinal: prev.final,
      nextId: next.id,
      nextDate: next.actualDate,
      nextInitialWeight: next.initialWeight,
      monthBoundariesCrossed: mb,
    })
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(pairs, null, 2))
console.log(`Wrote ${pairs.length} pairs to ${OUT_FILE}`)

// Quick summary
const zeroBoundary = pairs.filter((p) => p.monthBoundariesCrossed === 0)
const crossBoundary = pairs.filter((p) => p.monthBoundariesCrossed > 0)
const zeroBoundaryMatches = zeroBoundary.filter((p) => p.prevFinalWeight === p.nextInitialWeight)
const zeroBoundaryExceptions = zeroBoundary.filter((p) => p.prevFinalWeight !== p.nextInitialWeight)

console.log(`\nTotal pairs: ${pairs.length}`)
console.log(`Zero-boundary pairs: ${zeroBoundary.length}`)
console.log(
  `  matches (drop=0): ${zeroBoundaryMatches.length} (${((zeroBoundaryMatches.length / zeroBoundary.length) * 100).toFixed(1)}%)`
)
console.log(`  exceptions (drop!=0): ${zeroBoundaryExceptions.length}`)
if (zeroBoundaryExceptions.length > 0) {
  console.log('  exception details:')
  for (const e of zeroBoundaryExceptions) {
    console.log(
      `    ${e.pid}: ${e.prevId}(${e.prevDate.slice(0, 10)}) fw=${e.prevFinalWeight} -> ${e.nextId}(${e.nextDate.slice(0, 10)}) iw=${e.nextInitialWeight}`
    )
  }
}
console.log(`\nCross-boundary pairs: ${crossBoundary.length}`)
const crossDrops = crossBoundary.map((p) => p.prevFinalWeight - p.nextInitialWeight)
console.log(
  `  drop stats: min=${Math.min(...crossDrops)} max=${Math.max(...crossDrops)} mean=${(crossDrops.reduce((a, b) => a + b, 0) / crossDrops.length).toFixed(2)}`
)
