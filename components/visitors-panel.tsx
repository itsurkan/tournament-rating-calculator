"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"

type Counts = {
  day: number | null
  week: number | null
  month: number | null
  year: number | null
}

const STATS: { key: keyof Counts; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
]

function format(value: number | null, loading: boolean): string {
  if (loading) return "…"
  if (value == null) return "—"
  return value.toLocaleString()
}

export function VisitorsPanel() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch("/api/visits", { method: "POST" })
      .then((res) => res.json())
      .then((data: Counts) => {
        if (active) setCounts(data)
      })
      .catch(() => {
        if (active) setCounts(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section className="mt-12 border-t border-border pt-6">
      <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Users className="size-3.5" />
        Visitors
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map(({ key, label }) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
              {format(counts?.[key] ?? null, loading)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
