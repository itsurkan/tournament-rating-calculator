import { Redis } from "@upstash/redis"

export type VisitCounts = {
  day: number
  week: number
  month: number
  year: number
}

const KEY_PREFIX = "visits"

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * ISO-8601 week number and the year that week belongs to (in UTC).
 * The ISO year can differ from the calendar year near Jan 1 / Dec 31.
 */
function isoWeek(date: Date): { year: number; week: number } {
  // Work on a copy at UTC midnight.
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  // ISO weekday: Mon=1 .. Sun=7.
  const day = d.getUTCDay() || 7
  // Shift to the Thursday of this week — its calendar year is the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const isoYear = d.getUTCFullYear()
  const yearStart = Date.UTC(isoYear, 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return { year: isoYear, week }
}

/**
 * Derive the Redis counter keys for the calendar periods containing `date`.
 * Pure function (no I/O); all buckets use UTC. Unit-testable in isolation.
 */
export function periodKeys(date: Date) {
  const y = date.getUTCFullYear()
  const m = pad2(date.getUTCMonth() + 1)
  const d = pad2(date.getUTCDate())
  const { year: isoY, week } = isoWeek(date)
  return {
    day: `${KEY_PREFIX}:day:${y}-${m}-${d}`,
    week: `${KEY_PREFIX}:week:${isoY}-W${pad2(week)}`,
    month: `${KEY_PREFIX}:month:${y}-${m}`,
    year: `${KEY_PREFIX}:year:${y}`,
    total: `${KEY_PREFIX}:total`,
  }
}

/**
 * Lazily build an Upstash Redis client from the environment, or return null
 * when no credentials are configured (e.g. local dev before `vercel env pull`).
 * Supports both the Vercel KV (`KV_REST_API_*`) and Upstash
 * (`UPSTASH_REDIS_REST_*`) variable names.
 */
function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

/**
 * Increment the day/week/month/year (+ lifetime total) counters for `date`
 * in a single pipeline and return the new period counts. Returns null when
 * Redis is unavailable or the call fails (graceful degradation — the panel
 * renders "—" rather than surfacing an error).
 */
export async function recordVisit(date: Date): Promise<VisitCounts | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const keys = periodKeys(date)
    const pipeline = redis.pipeline()
    pipeline.incr(keys.day)
    pipeline.incr(keys.week)
    pipeline.incr(keys.month)
    pipeline.incr(keys.year)
    pipeline.incr(keys.total)
    const [day, week, month, year] = (await pipeline.exec()) as number[]
    return { day, week, month, year }
  } catch (err) {
    console.error("[visits] recordVisit failed:", (err as Error).message)
    return null
  }
}
