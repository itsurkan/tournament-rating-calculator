// Server-only. Bearer-token gate for /api/admin/*.
//
// ADMIN_TOKEN is a long random secret set once in the Vercel project env; the
// /admin page sends it as `Authorization: Bearer <token>`. When it is not set
// the admin API is disabled outright — never open by default.
import { createHash, timingSafeEqual } from "node:crypto"

export type AdminAuth = "ok" | "disabled" | "unauthorized"

const digest = (s: string) => createHash("sha256").update(s).digest()

export function checkAdminAuth(req: Request): AdminAuth {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return "disabled"
  const header = req.headers.get("authorization") ?? ""
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (!presented) return "unauthorized"
  // Hashing first makes the comparison constant-time regardless of length.
  return timingSafeEqual(digest(presented), digest(expected)) ? "ok" : "unauthorized"
}
