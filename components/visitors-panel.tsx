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

  const items: {
    key: string
    label: string
    short: string
    value: number | null
  }[] = [
    {
      key: "day",
      label: t("visits.today"),
      short: t("visits.todayShort"),
      value: counts?.day ?? null,
    },
    {
      key: "week",
      label: t("visits.week"),
      short: t("visits.weekShort"),
      value: counts?.week ?? null,
    },
    {
      key: "month",
      label: t("visits.month"),
      short: t("visits.monthShort"),
      value: counts?.month ?? null,
    },
    {
      key: "year",
      label: t("visits.year"),
      short: t("visits.yearShort"),
      value: counts?.year ?? null,
    },
  ]

  return (
    <section
      aria-label={t("visits.heading")}
      className="mt-8 border-t border-border pt-5 text-muted-foreground"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" aria-hidden />
        <span>{t("visits.heading")}</span>
      </div>
      <dl className="grid grid-cols-4 gap-2 sm:gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-lg border border-border px-2 py-2 text-center sm:px-3 sm:py-3 sm:text-left"
          >
            <dt className="truncate text-[11px] leading-tight sm:text-xs">
              <span className="sm:hidden">{it.short}</span>
              <span className="hidden sm:inline">{it.label}</span>
            </dt>
            <dd className="mt-1 text-base font-semibold tabular-nums text-foreground sm:text-lg">
              {counts === null ? (
                <span className="inline-block h-5 w-10 animate-pulse rounded bg-muted" />
              ) : (
                fmt(it.value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
