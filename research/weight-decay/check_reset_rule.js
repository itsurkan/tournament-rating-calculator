// Tests an alternative reset-trigger hypothesis: instead of (or in addition to)
// "prev.final <= 0", the true trigger might be "next.initial <= 0" (the player
// enters the NEXT tournament unrated), which resets that tournament's
// initialWeight to 0 regardless of the previous finalWeight.
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))

let bothZero = 0 // prev.final<=0 AND next.initial<=0
let onlyPrevFinalZero = 0
let onlyNextInitialZero = 0
let neitherZero = 0
const onlyNextInitialZeroDetails = []
const neitherZeroButResetDetails = []

for (const file of files) {
  const pid = path.basename(file, '.json')
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
  const seen = new Set()
  const entries = []
  for (const e of raw) {
    const key = `${e.id}|${e.actualDate}|${e.initial}|${e.final}|${e.initialWeight}|${e.finalWeight}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(e)
  }
  const origIndex = new Map()
  raw.forEach((e, idx) => {
    const key = `${e.id}|${e.actualDate}|${e.initial}|${e.final}|${e.initialWeight}|${e.finalWeight}`
    if (!origIndex.has(key)) origIndex.set(key, idx)
  })
  entries.sort((a, b) => {
    const da = new Date(a.actualDate).getTime()
    const db = new Date(b.actualDate).getTime()
    if (da !== db) return da - db
    const keyA = `${a.id}|${a.actualDate}|${a.initial}|${a.final}|${a.initialWeight}|${a.finalWeight}`
    const keyB = `${b.id}|${b.actualDate}|${b.initial}|${b.final}|${b.initialWeight}|${b.finalWeight}`
    return origIndex.get(keyB) - origIndex.get(keyA)
  })

  for (let i = 0; i < entries.length - 1; i++) {
    const prev = entries[i]
    const next = entries[i + 1]
    const prevFinalZero = prev.final <= 0
    const nextInitialZero = next.initial <= 0
    const resetHappened = next.initialWeight === 0

    if (prevFinalZero && nextInitialZero) bothZero++
    else if (prevFinalZero && !nextInitialZero) onlyPrevFinalZero++
    else if (!prevFinalZero && nextInitialZero) {
      onlyNextInitialZero++
      onlyNextInitialZeroDetails.push({ pid, prevId: prev.id, nextId: next.id, prevFinalWeight: prev.finalWeight, nextInitialWeight: next.initialWeight, resetHappened })
    } else {
      neitherZero++
      if (resetHappened && prev.finalWeight > 0) {
        neitherZeroButResetDetails.push({ pid, prevId: prev.id, nextId: next.id, prevFinal: prev.final, nextInitial: next.initial, prevFinalWeight: prev.finalWeight })
      }
    }
  }
}

console.log(`bothZero (prevFinal<=0 & nextInitial<=0): ${bothZero}`)
console.log(`onlyPrevFinalZero (prevFinal<=0, nextInitial>0): ${onlyPrevFinalZero}`)
console.log(`onlyNextInitialZero (prevFinal>0, nextInitial<=0): ${onlyNextInitialZero}`)
console.log(`neitherZero: ${neitherZero}`)

console.log(`\n=== onlyNextInitialZero cases (does reset still happen?) ===`)
for (const d of onlyNextInitialZeroDetails) {
  console.log(`  ${d.pid}: ${d.prevId}(fw=${d.prevFinalWeight}) -> ${d.nextId}(iw=${d.nextInitialWeight}) resetHappened=${d.resetHappened}`)
}

console.log(`\n=== neitherZero pairs where a reset (iw=0) STILL happened despite prevFinal>0 and nextInitial>0 ===`)
for (const d of neitherZeroButResetDetails) {
  console.log(`  ${d.pid}: ${d.prevId}(final=${d.prevFinal},fw=${d.prevFinalWeight}) -> ${d.nextId}(initial=${d.nextInitial})`)
}
