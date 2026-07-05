"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
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

  // Unfiltered → the design's match cards, grouped by stage, with progressive
  // disclosure.
  return <AllMatches matches={matches} profileUrls={profileUrls} />
}

const INITIAL_VISIBLE = 8

// A single match card: winner and loser stacked, each with their games won and
// the points they earned/lost. (ligas only exposes the aggregate game score —
// there are no per-set scores to show.)
function MatchCard({
  m,
  profileUrls,
}: {
  m: MatchContribution
  profileUrls: Record<string, string | null>
}) {
  const [wGames, lGames] = m.score.split(/[:\-]/)
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-2.5">
      <div className="flex items-center gap-3">
        <PlayerName
          id={m.winnerId}
          name={m.winnerName}
          profileUrls={profileUrls}
          className="min-w-0 flex-1 truncate font-semibold text-foreground"
        />
        <span className="w-5 text-right font-mono text-sm font-bold text-primary">
          {wGames?.trim()}
        </span>
        <span className="w-14 text-right font-mono text-sm font-semibold text-positive">
          {signedPoints(m.winnerPoints)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-3">
        <PlayerName
          id={m.loserId}
          name={m.loserName}
          profileUrls={profileUrls}
          className="min-w-0 flex-1 truncate text-muted-foreground"
        />
        <span className="w-5 text-right font-mono text-sm text-muted-foreground">
          {lGames?.trim()}
        </span>
        <span className="w-14 text-right font-mono text-sm text-negative">
          {signedPoints(m.loserPoints)}
        </span>
      </div>
    </div>
  )
}

function AllMatches({
  matches,
  profileUrls,
}: {
  matches: MatchContribution[]
  profileUrls: Record<string, string | null>
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  // Full per-stage counts (for the group headers), independent of what's shown.
  const stageSizes = new Map<string, number>()
  for (const m of matches) stageSizes.set(m.stageName, (stageSizes.get(m.stageName) ?? 0) + 1)

  const shown = expanded ? matches : matches.slice(0, INITIAL_VISIBLE)
  const hiddenCount = matches.length - shown.length

  // Group the shown matches into consecutive same-stage runs.
  const groups: { stage: string; items: MatchContribution[] }[] = []
  for (const m of shown) {
    const last = groups[groups.length - 1]
    if (last && last.stage === m.stageName) last.items.push(m)
    else groups.push({ stage: m.stageName, items: [m] })
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={`${g.stage}-${gi}`} className="flex flex-col gap-1.5">
          {g.stage && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {g.stage}
              </span>
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono text-[11px] text-muted-foreground">
                {t("matches.roundCount", { n: stageSizes.get(g.stage) ?? g.items.length })}
              </span>
            </div>
          )}
          {g.items.map((m, i) => (
            <MatchCard key={`${m.stageName}-${m.gameId}-${i}`} m={m} profileUrls={profileUrls} />
          ))}
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {t("matches.showMore", { n: hiddenCount })}
          <ChevronDown className="size-4" />
        </button>
      )}
      {expanded && matches.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {t("matches.showLess")}
          <ChevronDown className="size-4 rotate-180" />
        </button>
      )}
    </div>
  )
}
