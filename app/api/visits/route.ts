import { NextResponse } from "next/server"
import { readVisits, recordVisit } from "@/lib/visits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Local development / debugging must not inflate the public counters: those
// requests still get the real numbers back, they just don't add to them.
// VISITS_READONLY=1 forces the same behaviour on any deployment.
function isCountable(req: Request): boolean {
  if (process.env.VISITS_READONLY === "1") return false
  if (process.env.NODE_ENV !== "production") return false
  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase()
  return !(
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local")
  )
}

export async function POST(req: Request) {
  const now = new Date()
  const counts = isCountable(req) ? await recordVisit(now) : await readVisits(now)
  if (!counts) {
    return NextResponse.json({ day: null, week: null, month: null, year: null })
  }
  return NextResponse.json(counts)
}
