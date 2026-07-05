"use client"

import type { MatchContribution } from "@/lib/rating"
import { useI18n } from "@/lib/i18n"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

  // When filtered to a single participant, sum the points THEY earned/lost
  // across the shown matches (winner side when they won, loser side when they
  // lost) and surface it as a footer total.
  const highlightMatches = highlightId
    ? matches.filter((m) => m.winnerId === highlightId || m.loserId === highlightId)
    : []
  const highlightName = highlightMatches.length
    ? highlightMatches[0].winnerId === highlightId
      ? highlightMatches[0].winnerName
      : highlightMatches[0].loserName
    : ""
  const highlightTotal = highlightMatches.reduce(
    (sum, m) => sum + (m.winnerId === highlightId ? m.winnerPoints : m.loserPoints),
    0,
  )

  // Gold pill matching the highlighted name, reused on the points value that
  // belongs to the filtered participant.
  const pointsPill =
    "rounded px-1 bg-primary/15 ring-1 ring-inset ring-primary/40"

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
                    className="font-semibold text-positive"
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
                <span
                  className={[
                    "font-medium text-positive",
                    m.winnerId === highlightId ? pointsPill : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {m.winnerPoints >= 0 ? "+" : ""}
                  {m.winnerPoints}
                </span>
                <span className="text-muted-foreground"> / </span>
                <span
                  className={[
                    "text-negative",
                    m.loserId === highlightId ? pointsPill : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {m.loserPoints}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        {highlightMatches.length > 0 && (
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={4}
                className="text-right text-sm font-medium text-muted-foreground"
              >
                {t("matches.totalPoints", { name: highlightName })}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span
                  className={[
                    "font-semibold",
                    pointsPill,
                    highlightTotal >= 0
                      ? "text-positive"
                      : "text-negative",
                  ].join(" ")}
                >
                  {highlightTotal > 0 ? "+" : ""}
                  {highlightTotal}
                </span>
              </TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  )
}
