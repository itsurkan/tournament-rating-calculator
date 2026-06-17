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

export function MatchesTable({ matches }: { matches: MatchContribution[] }) {
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
                  <span className="font-medium">{m.winnerName}</span>
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
                  <span className="text-muted-foreground">{m.loserName}</span>
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {m.loserRatingBefore.toFixed(1)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {m.stageName}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-primary">
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
