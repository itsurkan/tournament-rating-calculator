import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { checkAdminAuth } from "@/lib/admin-auth"
import {
  CacheConfigWriteError,
  DEFAULT_CACHE_CONFIG,
  LIGAS_TAGS,
  cacheConfigStatus,
  readCacheConfig,
  sanitizeCacheConfig,
  writeCacheConfig,
} from "@/lib/cache-config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store" }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

function gate(req: Request): NextResponse | null {
  const auth = checkAdminAuth(req)
  if (auth === "ok") return null
  if (auth === "disabled") return json({ code: "admin_disabled" }, 503)
  return json({ code: "unauthorized" }, 401)
}

/** Current TTLs, where they come from, and whether they can be saved. */
export async function GET(req: Request) {
  const denied = gate(req)
  if (denied) return denied
  const { config, source } = await readCacheConfig()
  return json({ config, source, defaults: DEFAULT_CACHE_CONFIG, status: cacheConfigStatus() })
}

/** Save new TTLs. Applies to fetches from now on; already-cached players keep
 *  their old expiry until purged (DELETE) or expired. */
export async function PUT(req: Request) {
  const denied = gate(req)
  if (denied) return denied
  const config = sanitizeCacheConfig(await req.json().catch(() => null))
  if (!config) return json({ code: "invalid_config" }, 400)
  try {
    await writeCacheConfig(config)
  } catch (err) {
    if (err instanceof CacheConfigWriteError) return json({ code: "not_writable", message: err.message }, 501)
    throw err
  }
  return json({ config, source: "edge-config" })
}

/** Purge every cached ligas player / rankings response right now. */
export async function DELETE(req: Request) {
  const denied = gate(req)
  if (denied) return denied
  revalidateTag(LIGAS_TAGS.player, "max")
  revalidateTag(LIGAS_TAGS.rankings, "max")
  return json({ purged: [LIGAS_TAGS.player, LIGAS_TAGS.rankings], at: new Date().toISOString() })
}
