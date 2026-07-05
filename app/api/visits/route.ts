import { NextResponse } from "next/server"
import { recordVisit } from "@/lib/visits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const counts = await recordVisit(new Date())
  if (!counts) {
    return NextResponse.json({ day: null, week: null, month: null, year: null })
  }
  return NextResponse.json(counts)
}
