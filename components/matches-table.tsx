"use client"

import type { MatchContribution } from "@/lib/rating"
import { useI18n } from "@/lib/i18n"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function PlayerName({
  id,
  name,
  highlightId,
  profileUrls,
  className = "",
}: {
  id: string
  name: string
  highlightId?: string
  profileUrls: Record<string, string | null>
  className?: string
}) {
  const url = profileUrls[id]
  const highlighted = highlightId === id
  // Only links get the hover/underline affordance; plain-text names (no profile
  // URL) must not look clickable. Mirrors results-table.tsx.
  // Keep the column's own color (green winner / muted loser) when highlighted —
  // only add a clearly-visible amber pill + weight, never override the text color.
  const highlight = highlighted
    ? "rounded px-1 font-semibold bg-amber-400/20 ring-1 ring-inset ring-amber-500/50"
    : ""
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={[
          "underline-offset-4 hover:text-primary hover:underline",
          highlight,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {name}
      </a>
    )
  }
  return (
    <span className={[highlight, className].filter(Boolean).join(" ")}>{name}</span>
  )
}

export function MatchesTable({
  matches,
  highlightId,
  profileUrls = {},
}: {
  matches: MatchContribution[]
  highlightId?: string
  profileUrls?: Record<string, string | null>
}) {
  const { t } = useI18n()
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t("matches.col.winner")}</TableHead>
            <TableHead className="text-center">{t("matches.col.score")}</TableHead>
            <TableHead>{t("matches.col.loser")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("matches.col.stage")}</TableHead>
            <TableHead className="text-right">{t("matches.col.points")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m, i) => (
            // ligas numbers games per stage, so gameId repeats across stages —
            // qualify it with the stage (and index) to keep React keys unique.
            <TableRow key={`${m.stageName}-${m.gameId}-${i}`}>
              <TableCell>
                <div className="flex flex-col">
                  <PlayerName
                    id={m.winnerId}
                    name={m.winnerName}
                    highlightId={highlightId}
                    profileUrls={profileUrls}
                    className="font-semibold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.winnerRatingBefore.toFixed(1)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center font-mono text-sm tabular-nums">
                {m.score}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <PlayerName
                    id={m.loserId}
                    name={m.loserName}
                    highlightId={highlightId}
                    profileUrls={profileUrls}
                    className="text-muted-foreground"
                  />
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {m.loserRatingBefore.toFixed(1)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {m.stageName}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {m.winnerPoints >= 0 ? "+" : ""}
                  {m.winnerPoints}
                </span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">{m.loserPoints}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
