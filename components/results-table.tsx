"use client"

import type { PlayerResult } from "@/lib/rating"
import { useI18n } from "@/lib/i18n"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Fragment, useEffect, useState } from "react"

function RatingInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (value: number) => void
  ariaLabel: string
}) {
  // Local string draft so the field can be cleared and edited freely
  // (a numeric `0` would otherwise stick and turn typed input into "01").
  const [draft, setDraft] = useState(String(value))

  // Re-sync when the value changes from outside (e.g. tournament loaded).
  useEffect(() => {
    if (Number(draft) !== value) setDraft(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <Input
      type="number"
      step="0.1"
      min="0"
      value={draft}
      onChange={(e) => {
        const next = e.target.value
        setDraft(next)
        onChange(next === "" ? 0 : Number(next))
      }}
      onBlur={() => setDraft(String(value))}
      className="h-8 w-20 text-right font-mono"
      aria-label={ariaLabel}
    />
  )
}

// Δ pill (colored fill + border), matching the design's rating-change badge.
// Zero is a quiet dash.
function DeltaPill({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) {
    return <span className="font-mono text-xs text-muted-foreground">0.0</span>
  }
  const up = change > 0
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold ${
        up
          ? "border-positive/30 bg-positive/15 text-positive"
          : "border-negative/30 bg-negative/15 text-negative"
      }`}
    >
      {up ? "+" : ""}
      {change.toFixed(1)}
    </span>
  )
}

function PlayerName({
  p,
  profileUrls,
}: {
  p: PlayerResult
  profileUrls: Record<string, string | null>
}) {
  const url = profileUrls[p.id]
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold underline-offset-4 hover:text-primary hover:underline"
    >
      {p.name}
    </a>
  ) : (
    <span className="font-semibold">{p.name}</span>
  )
}

export function ResultsTable({
  results,
  startRatings,
  onRatingChange,
  profileUrls = {},
  editing = false,
}: {
  results: PlayerResult[]
  startRatings: Record<string, number>
  onRatingChange: (id: string, value: number) => void
  profileUrls?: Record<string, string | null>
  editing?: boolean
}) {
  const { t } = useI18n()

  // Edit mode — editable start rating (+ weight shown as a subtitle), matching
  // the design's edit view.
  if (editing) {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_5rem_3.25rem] items-center gap-2 border-b border-border px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          <span className="text-center">#</span>
          <span>{t("results.col.player")}</span>
          <span className="text-right">{t("results.col.startRating")}</span>
          <span className="text-right">{t("results.col.change")}</span>
        </div>
        {results.map((p, i) => (
          <div
            key={p.id}
            className="grid grid-cols-[1.75rem_minmax(0,1fr)_5rem_3.25rem] items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <span className="text-center font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex min-w-0 flex-col">
              <PlayerName p={p} profileUrls={profileUrls} />
              <span className="font-mono text-[11px] text-muted-foreground">
                {t("results.col.weight")}: {p.weightBefore} → {p.weightAfter}
              </span>
            </div>
            <div className="flex justify-end">
              <RatingInput
                value={startRatings[p.id] ?? 0}
                onChange={(value) => onRatingChange(p.id, value)}
                ariaLabel={t("results.startRatingFor", { name: p.name })}
              />
            </div>
            <span className="text-right font-mono text-sm font-semibold">
              <span
                className={
                  p.change > 0.05
                    ? "text-positive"
                    : p.change < -0.05
                      ? "text-negative"
                      : "text-muted-foreground"
                }
              >
                {p.change > 0.05 ? "+" : ""}
                {p.change.toFixed(1)}
              </span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  // Read mode. Two layouts:
  //  • mobile — a compact shared grid: rank, player + W–L, rating stacked
  //    (old struck → new gold), Δ pill.
  //  • md+ (web) — a full table with separate weight, before, after and Δ
  //    columns, so the extra width is put to use instead of sitting empty.
  return (
    <>
      {/* Mobile */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] overflow-hidden rounded-lg border border-border md:hidden">
        <div className="border-b border-border py-2.5 pl-2.5 pr-1 text-center text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          #
        </div>
        <div className="border-b border-border py-2.5 pr-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("results.col.player")}
        </div>
        <div className="border-b border-border px-1 py-2.5 text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {t("results.col.rating")}
        </div>
        <div className="border-b border-border py-2.5 pl-2 pr-3 text-right text-[11px] font-semibold text-muted-foreground">
          Δ
        </div>
        {results.map((p, i) => {
          const before = startRatings[p.id] ?? 0
          const changed = Math.abs(p.change) >= 0.05
          const b = i === results.length - 1 ? "" : "border-b border-border"
          return (
            <Fragment key={p.id}>
              <div className={`${b} flex items-center justify-center py-3 pl-2.5 pr-1 font-mono text-xs text-muted-foreground`}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className={`${b} flex min-w-0 items-center gap-2 py-3 pr-2`}>
                <PlayerName p={p} profileUrls={profileUrls} />
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {p.wins}–{p.losses}
                </span>
              </div>
              <div className={`${b} flex flex-col items-end justify-center px-1 py-3 leading-tight`}>
                {changed && (
                  <span className="font-mono text-[11px] text-negative line-through">
                    {before.toFixed(1)}
                  </span>
                )}
                <span className="font-mono text-sm font-semibold text-primary">
                  {p.ratingAfter.toFixed(1)}
                </span>
              </div>
              <div className={`${b} flex items-center justify-end py-3 pl-2 pr-3`}>
                <DeltaPill change={p.change} />
              </div>
            </Fragment>
          )
        })}
      </div>

      {/* Web (md+) */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>th]:text-[10.5px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[0.1em] [&>th]:text-muted-foreground">
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>{t("results.col.player")}</TableHead>
              <TableHead className="text-center">{t("results.col.wl")}</TableHead>
              <TableHead className="text-center">{t("results.col.weight")}</TableHead>
              <TableHead className="text-right">{t("results.col.startRating")}</TableHead>
              <TableHead className="text-right">{t("results.col.after")}</TableHead>
              <TableHead className="w-20 text-right">{t("results.col.change")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((p, i) => {
              const before = startRatings[p.id] ?? 0
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </TableCell>
                  <TableCell>
                    <PlayerName p={p} profileUrls={profileUrls} />
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {p.wins}–{p.losses}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {p.weightBefore}
                    <span className="text-muted-foreground/50"> → </span>
                    {p.weightAfter}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-muted-foreground">
                    {before.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                    {p.ratingAfter.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex justify-end">
                      <DeltaPill change={p.change} />
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
