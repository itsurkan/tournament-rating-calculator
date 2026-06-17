"use client"

import type { MatchDelta } from "@/lib/rating"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function MatchesTable({ matches }: { matches: MatchDelta[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Winner</TableHead>
            <TableHead className="text-center">Score</TableHead>
            <TableHead>Loser</TableHead>
            <TableHead className="hidden md:table-cell">Stage</TableHead>
            <TableHead className="text-right">Points</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matches.map((m) => (
            <TableRow key={String(m.gameId)}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{m.winnerName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {m.winnerRatingBefore.toFixed(2)}
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
                    {m.loserRatingBefore.toFixed(2)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {m.stageName}
              </TableCell>
              <TableCell className="text-right font-mono">
                <span className="text-primary">+{m.delta.toFixed(2)}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-destructive">
                  -{(m.delta / 2).toFixed(2)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
