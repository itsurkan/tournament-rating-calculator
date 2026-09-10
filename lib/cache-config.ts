// Server-only. Runtime-tunable caching knobs for the ligas lookups in
// /api/tournament, so the TTLs can be changed from /admin without a redeploy.
//
// Storage is Vercel Edge Config — a tiny, globally replicated key-value store
// built for exactly this (config read on every request, written rarely):
//
//   read:  EDGE_CONFIG                         connection string; set
//          automatically when the store is connected to the Vercel project.
//   write: VERCEL_API_TOKEN + EDGE_CONFIG_ID   (+ VERCEL_TEAM_ID for team
//          accounts) — the Vercel REST API is the only way to write items.
//
// Without EDGE_CONFIG the defaults below apply and /admin shows the TTLs as
// read-only. The "clear cache" action needs none of this.
import { get } from "@vercel/edge-config"

export type CacheConfig = {
  /** Seconds to keep a player's ranking history + profile. */
  playerTtlS: number
  /** Seconds to keep the org's ranking list. */
  rankingsTtlS: number
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  playerTtlS: 3 * 3600,
  rankingsTtlS: 6 * 3600,
}

/** Tags on the cached ligas fetches, so /admin can purge them on demand. */
export const LIGAS_TAGS = {
  player: "ligas-player",
  rankings: "ligas-rankings",
} as const

export const EDGE_CONFIG_KEY = "ligasCache"

/** Upper bound for any TTL: 30 days. Anything longer is a typo. */
export const MAX_TTL_S = 30 * 24 * 3600

const toTtl = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const i = Math.round(n)
  return i >= 0 && i <= MAX_TTL_S ? i : null
}

/**
 * Validate an untrusted config object (from Edge Config or the admin form).
 * Returns null unless BOTH fields are present and sane, so a half-written or
 * corrupted value can never leak into the fetch options.
 */
export function sanitizeCacheConfig(input: unknown): CacheConfig | null {
  if (!input || typeof input !== "object") return null
  const o = input as Record<string, unknown>
  const playerTtlS = toTtl(o.playerTtlS)
  const rankingsTtlS = toTtl(o.rankingsTtlS)
  if (playerTtlS == null || rankingsTtlS == null) return null
  return { playerTtlS, rankingsTtlS }
}

export type CacheConfigStatus = {
  /** EDGE_CONFIG is set — values come from the store. */
  readable: boolean
  /** VERCEL_API_TOKEN + EDGE_CONFIG_ID are set — /admin can save. */
  writable: boolean
}

export function cacheConfigStatus(): CacheConfigStatus {
  return {
    readable: Boolean(process.env.EDGE_CONFIG),
    writable: Boolean(process.env.VERCEL_API_TOKEN && process.env.EDGE_CONFIG_ID),
  }
}

export type CacheConfigSource = "edge-config" | "default"

/**
 * Current config. Falls back to the defaults when Edge Config is not connected,
 * holds no value yet, or is unreachable — a config read must never take the
 * calculator down.
 */
export async function readCacheConfig(): Promise<{ config: CacheConfig; source: CacheConfigSource }> {
  if (!process.env.EDGE_CONFIG) return { config: DEFAULT_CACHE_CONFIG, source: "default" }
  try {
    const stored = sanitizeCacheConfig(await get(EDGE_CONFIG_KEY))
    if (stored) return { config: stored, source: "edge-config" }
  } catch (err) {
    console.log("[admin] edge config read failed:", (err as Error).message)
  }
  return { config: DEFAULT_CACHE_CONFIG, source: "default" }
}

export class CacheConfigWriteError extends Error {}

/** Upsert the config item through the Vercel REST API. */
export async function writeCacheConfig(config: CacheConfig): Promise<void> {
  const token = process.env.VERCEL_API_TOKEN
  const id = process.env.EDGE_CONFIG_ID
  if (!token || !id) {
    throw new CacheConfigWriteError("Edge Config is not writable: set VERCEL_API_TOKEN and EDGE_CONFIG_ID")
  }
  const teamId = process.env.VERCEL_TEAM_ID
  const url = `https://api.vercel.com/v1/edge-config/${encodeURIComponent(id)}/items${
    teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""
  }`
  const res = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ items: [{ operation: "upsert", key: EDGE_CONFIG_KEY, value: config }] }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new CacheConfigWriteError(`Vercel API ${res.status}: ${body.slice(0, 300)}`)
  }
}
