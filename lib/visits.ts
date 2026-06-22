// Server-only visit counting. Do NOT import from a client component.
//
// Counts are stored in a free, no-signup hosted counter service
// (https://abacus.jasoncameron.dev): a single GET to /hit/<namespace>/<key>
// atomically increments that key and returns the new value. Each calendar
// period (day/week/month/year) is its own key, so no database to provision and
// no env vars required. The namespace can be overridden with VISITS_NAMESPACE.
export type VisitCounts = {
  day: number | null
  week: number | null
  month: number | null
  year: number | null
}

const COUNTER_BASE = "https://abacus.jasoncameron.dev/hit"
const DEFAULT_NAMESPACE = "tournament-rating-calc-itsurkan"
const REQUEST_TIMEOUT_MS = 5000

function namespace(): string {
  return process.env.VISITS_NAMESPACE || DEFAULT_NAMESPACE
}

const pad = (n: number) => String(n).padStart(2, "0")

// ISO-8601 week number + the year that week belongs to (may differ from the
// calendar year at the boundary). Algorithm: shift to the Thursday of the
// current ISO week, then count weeks from Jan 1 of that Thursday's year.
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = d.getUTCDay() || 7 // Sun=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // move to Thursday
  const year = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year, week }
}

// Calendar-period counter keys in UTC. Keys are plain hyphenated strings so they
// are safe as a URL path segment on the counter service.
export function periodKeys(date: Date) {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const { year: wy, week } = isoWeek(date)
  return {
    day: `day-${y}-${m}-${d}`,
    week: `week-${wy}-w${pad(week)}`,
    month: `month-${y}-${m}`,
    year: `year-${y}`,
  }
}

// Increment one counter key and return its new value, or null on any failure
// (network error, non-2xx, unexpected body) — a missing count is never an error.
async function bump(key: string): Promise<number | null> {
  try {
    const res = await fetch(`${COUNTER_BASE}/${namespace()}/${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const value = (data as { value?: unknown })?.value
    return typeof value === "number" ? value : null
  } catch {
    return null
  }
}

// Increment all four period counters for `date` (in parallel) and return the new
// values. Any period that fails to record comes back as null (panel shows "—").
export async function recordVisit(date: Date): Promise<VisitCounts> {
  const k = periodKeys(date)
  const [day, week, month, year] = await Promise.all([
    bump(k.day),
    bump(k.week),
    bump(k.month),
    bump(k.year),
  ])
  return { day, week, month, year }
}
