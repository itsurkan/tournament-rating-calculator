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
  // only add a clearly-visible gold pill + weight, never override the text color.
  const highlight = highlighted
    ? "rounded px-1 font-semibold bg-primary/15 ring-1 ring-inset ring-primary/40"
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

// Signed one-decimal points, e.g. +1.0 / 0.0 / -2.0.
function signedPoints(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`
}

// A win/loss points pill (colored fill + border), matching the design.
function PointsPill({ points }: { points: number }) {
  const positive = points >= 0
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold ${
        positive
          ? "border-positive/30 bg-positive/15 text-positive"
          : "border-negative/30 bg-negative/15 text-negative"
      }`}
    >
      {signedPoints(points)}
    </span>
  )
}

// First-person view of a filtered participant's matches: a W/L result badge,
// the opponent (name + their pre-tournament rating + stage), the score from the
// participant's perspective, and the points they earned/lost — plus a total.
function FirstPersonMatches({
  matches,
  highlightId,
  profileUrls,
}: {
  matches: MatchContribution[]
  highlightId: string
  profileUrls: Record<string, string | null>
}) {
  const { t } = useI18n()
  const rows = matches.map((m, i) => {
    const won = m.winnerId === highlightId
    const oppId = won ? m.loserId : m.winnerId
    const oppName = won ? m.loserName : m.winnerName
    const oppRating = won ? m.loserRatingBefore : m.winnerRatingBefore
    const points = won ? m.winnerPoints : m.loserPoints
    // ligas stores score as winner:loser — flip it when the participant lost so
    // it always reads as "their games : opponent's games".
    const [a, b] = m.score.split(/[:\-]/)
    const score = won ? m.score : b && a ? `${b.trim()}:${a.trim()}` : m.score
    return { key: `${m.stageName}-${m.gameId}-${i}`, won, oppId, oppName, oppRating, points, score, stage: m.stageName }
  })
  const total = rows.reduce((sum, r) => sum + r.points, 0)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent [&>th]:text-[10.5px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[0.1em] [&>th]:text-muted-foreground">
            <TableHead className="w-10" />
            <TableHead>{t("matches.col.opponent")}</TableHead>
            <TableHead className="text-center">{t("matches.col.score")}</TableHead>
            <TableHead className="text-right">{t("matches.col.points")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>
                <span
                  className={`flex size-6 items-center justify-center rounded-md border text-[11px] font-bold ${
                    r.won
                      ? "border-positive/30 bg-positive/15 text-positive"
                      : "border-negative/30 bg-negative/15 text-negative"
                  }`}
                  title={r.won ? t("matches.won") : t("matches.lost")}
                >
                  {r.won ? t("matches.resultWin") : t("matches.resultLoss")}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <PlayerName
                    id={r.oppId}
                    name={r.oppName}
                    profileUrls={profileUrls}
                    className="font-medium text-foreground"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {r.oppRating.toFixed(1)} · {r.stage}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center font-mono text-sm font-semibold tabular-nums">
                {r.score}
              </TableCell>
              <TableCell className="text-right">
                <PointsPill points={r.points} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={3}
              className="text-right text-sm font-medium text-muted-foreground"
            >
              {t("matches.total")}
            </TableCell>
            <TableCell className="text-right">
              <PointsPill points={total} />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
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

  // Filtered to a single participant → show the design's first-person layout.
  if (highlightId) {
    return (
      <FirstPersonMatches
        matches={matches}
        highlightId={highlightId}
        profileUrls={profileUrls}
      />
    )
  }

  // Unfiltered → the full winner-vs-loser table with per-side points.
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent [&>th]:text-[10.5px] [&>th]:font-semibold [&>th]:uppercase [&>th]:tracking-[0.1em] [&>th]:text-muted-foreground">
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
                <span className="font-medium text-positive">
                  {m.winnerPoints >= 0 ? "+" : ""}
                  {m.winnerPoints}
                </span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-negative">{m.loserPoints}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
