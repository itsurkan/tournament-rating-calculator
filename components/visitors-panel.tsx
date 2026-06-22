"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type Counts = {
  day: number | null
  week: number | null
  month: number | null
  year: number | null
}

const EMPTY: Counts = { day: null, week: null, month: null, year: null }

export function VisitorsPanel() {
  const { t } = useI18n()
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/visits", { method: "POST" })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: Counts) => {
        if (active) setCounts(data)
      })
      .catch(() => {
        if (active) setCounts(EMPTY)
      })
    return () => {
      active = false
    }
  }, [])

  const fmt = (n: number | null | undefined) =>
    typeof n === "number" ? n.toLocaleString() : "—"

  const items: { key: string; label: string; value: number | null }[] = [
    { key: "day", label: t("visits.today"), value: counts?.day ?? null },
    { key: "week", label: t("visits.week"), value: counts?.week ?? null },
    { key: "month", label: t("visits.month"), value: counts?.month ?? null },
    { key: "year", label: t("visits.year"), value: counts?.year ?? null },
  ]

  return (
    <footer className="mt-10 border-t border-border pt-6 text-muted-foreground">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" aria-hidden />
        <span>{t("visits.heading")}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.key} className="rounded-lg border border-border p-3">
            <dt className="text-xs">{it.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {counts === null ? (
                <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted" />
              ) : (
                fmt(it.value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  )
}
