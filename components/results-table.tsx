"use client"

import type { PlayerResult } from "@/lib/rating"
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
  if (Math.abs(change) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
        <Minus className="size-3.5" />
        0.00
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
      {change.toFixed(2)}
    </span>
  )
}

export function ResultsTable({
  results,
  startRatings,
  onRatingChange,
}: {
  results: PlayerResult[]
  startRatings: Record<string, number>
  onRatingChange: (id: string, value: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">W / L</TableHead>
            <TableHead className="w-36 text-right">Start rating</TableHead>
            <TableHead className="text-right">After</TableHead>
            <TableHead className="text-right">Change</TableHead>
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
                  <span className="font-medium">{p.name}</span>
                  {p.provisional && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      provisional
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono text-sm">
                <span className="text-primary">{p.wins}</span>
                <span className="text-muted-foreground"> / </span>
                <span className="text-muted-foreground">{p.losses}</span>
              </TableCell>
              <TableCell className="text-right">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  value={startRatings[p.id] ?? 0}
                  onChange={(e) => onRatingChange(p.id, Number(e.target.value))}
                  className="ml-auto h-8 w-24 text-right font-mono"
                  aria-label={`Starting rating for ${p.name}`}
                />
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {p.ratingAfter.toFixed(2)}
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
