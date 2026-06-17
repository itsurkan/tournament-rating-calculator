"use client"

import type { PlayerResult } from "@/lib/rating"
import { useI18n } from "@/lib/i18n"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

function ChangeCell({ change }: { change: number }) {
  if (Math.abs(change) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
        <Minus className="size-3.5" />
        0.0
      </span>
    )
  }
  const up = change > 0
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-medium ${
        up ? "text-primary" : "text-destructive"
      }`}
    >
      {up ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {up ? "+" : ""}
      {change.toFixed(1)}
    </span>
  )
}

export function ResultsTable({
  results,
  startRatings,
  onRatingChange,
  profileUrls = {},
}: {
  results: PlayerResult[]
  startRatings: Record<string, number>
  onRatingChange: (id: string, value: number) => void
  profileUrls?: Record<string, string | null>
}) {
  const { t } = useI18n()
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>{t("results.col.player")}</TableHead>
            <TableHead className="text-center">{t("results.col.wl")}</TableHead>
            <TableHead className="hidden text-center sm:table-cell">{t("results.col.weight")}</TableHead>
            <TableHead className="w-36 text-right">{t("results.col.startRating")}</TableHead>
            <TableHead className="text-right">{t("results.col.after")}</TableHead>
            <TableHead className="text-right">{t("results.col.change")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((p, i) => (
            <TableRow key={p.id}>
              <TableCell className="text-center font-mono text-muted-foreground">
                {i + 1}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {profileUrls[p.id] ? (
                    <a
                      href={profileUrls[p.id] as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium underline-offset-4 hover:text-primary hover:underline"
                    >
                      {p.name}
                    </a>
                  ) : (
                    <span className="font-medium">{p.name}</span>
                  )}
                  {p.provisional && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {t("results.provisional")}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono text-sm">
                <span className="text-primary">{p.wins}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-muted-foreground">{p.losses}</span>
              </TableCell>
              <TableCell className="hidden text-center font-mono text-xs text-muted-foreground sm:table-cell">
                {p.weightBefore}
                <span className="text-muted-foreground/50"> → </span>
                {p.weightAfter}
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={startRatings[p.id] ?? 0}
                  onChange={(e) => onRatingChange(p.id, Number(e.target.value))}
                  className="ml-auto h-8 w-24 text-right font-mono"
                  aria-label={t("results.startRatingFor", { name: p.name })}
                />
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {p.ratingAfter.toFixed(1)}
              </TableCell>
              <TableCell className="text-right">
                <ChangeCell change={p.change} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
