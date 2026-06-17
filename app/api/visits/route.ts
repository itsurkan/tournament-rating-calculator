import { NextResponse } from "next/server"
import { recordVisit } from "@/lib/visits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Records one page load and returns the current calendar-period counts.
// When Redis is not configured the counts are null and the panel shows "—".
export async function POST() {
  const counts = await recordVisit(new Date())
  if (!counts) {
    return NextResponse.json({ day: null, week: null, month: null, year: null })
  }
  return NextResponse.json(counts)
}
