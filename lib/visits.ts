// Server-only visit counting. Do NOT import from a client component.
import { Redis } from "@upstash/redis"
export type VisitCounts = {
  day: number
  week: number
  month: number
  year: number
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

export function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function recordVisit(date: Date): Promise<VisitCounts | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const k = periodKeys(date)
    const pipe = redis.pipeline()
    pipe.incr(k.day)
    pipe.incr(k.week)
    pipe.incr(k.month)
    pipe.incr(k.year)
    pipe.incr(k.total)
    const [day, week, month, year] = (await pipe.exec()) as number[]
    return { day, week, month, year }
  } catch (err) {
    console.error("recordVisit failed", err)
    return null
  }
}

export function periodKeys(date: Date) {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const { year: wy, week } = isoWeek(date)
  return {
    day: `visits:day:${y}-${m}-${d}`,
    week: `visits:week:${wy}-W${pad(week)}`,
    month: `visits:month:${y}-${m}`,
    year: `visits:year:${y}`,
    total: `visits:total`,
  }
}
