"use client"

import { useMemo, useState } from "react"
import type { TournamentResponse } from "@/lib/types"
import { calculateRatings, type Match, type PlayerInput } from "@/lib/rating"
import { ResultsTable } from "@/components/results-table"
import { MatchesTable } from "@/components/matches-table"
import { VisitorsPanel } from "@/components/visitors-panel"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, MapPin, Calendar, Trophy } from "lucide-react"

const DEFAULT_RATING = 0 // provisional / unrated players start with no rating
const EXAMPLE = "https://ligas.io/tournament/2el6ef/results"

export default function Page() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TournamentResponse | null>(null)
  const [startRatings, setStartRatings] = useState<Record<string, number>>({})
  const [factor, setFactor] = useState(1)

  async function handleCalculate(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    setLoading(true)
    setData(null)
    try {
      const res = await fetch("/api/tournament", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Something went wrong.")
      const payload = json as TournamentResponse
      const ratings: Record<string, number> = {}
      for (const p of payload.players) {
        ratings[p.id] = p.ranking != null ? Math.round(p.ranking * 100) / 100 : DEFAULT_RATING
      }
      setStartRatings(ratings)
      setData(payload)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const result = useMemo(() => {
    if (!data) return null
    const players: PlayerInput[] = data.players.map((p) => ({
      id: p.id,
      name: p.name,
      rating: startRatings[p.id] ?? DEFAULT_RATING,
      weight: p.weight,
      provisional: p.provisional,
    }))
    const matches: Match[] = data.matches.map((m) => ({
      gameId: m.gameId,
      stageName: m.stageName,
      winnerId: m.winnerId,
      loserId: m.loserId,
      score: m.score,
    }))
    return calculateRatings(players, matches, factor)
  }, [data, startRatings, factor])

  function setRating(id: string, value: number) {
    setStartRatings((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 md:py-16">
      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Table tennis rating calculator
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          Ligas Rating Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Paste a ligas.io tournament URL to instantly calculate each
          player&apos;s rating change using the official FNTU formula &mdash; no
          waiting for ligas to process the event. Starting ratings and weights
          are pulled live from each player&apos;s profile and remain fully
          editable.
        </p>
      </header>

      <form onSubmit={handleCalculate} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="url"
          inputMode="url"
          placeholder={EXAMPLE}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-11 flex-1"
          aria-label="Ligas tournament URL"
        />
        <Button type="submit" disabled={loading || !url.trim()} className="h-11 px-6">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Calculating
            </>
          ) : (
            "Calculate"
          )}
        </Button>
      </form>

      <div className="mt-2 text-sm text-muted-foreground">
        Try the example:{" "}
        <button
          type="button"
          onClick={() => setUrl(EXAMPLE)}
          className="font-mono text-primary underline-offset-4 hover:underline"
        >
          {EXAMPLE}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && result && (
        <section className="mt-10">
          <div className="mb-6 rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-primary/15 p-2 text-primary">
                <Trophy className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold leading-tight">
                  <a
                    href={data.tournament.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:text-primary hover:underline"
                  >
                    {data.tournament.name}
                  </a>
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {data.tournament.orgName && <span>{data.tournament.orgName}</span>}
                  {data.tournament.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {data.tournament.location}
                    </span>
                  )}
                  {data.tournament.start && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(data.tournament.start).toLocaleDateString()}
                    </span>
                  )}
                  <span>{data.players.length} players</span>
                  <span>{data.matches.length} matches</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {data.tournament.processed
                    ? "Already processed by ligas — starting ratings are each player's pre-tournament values, so “After” should match ligas' official result."
                    : "Not yet processed by ligas — starting ratings are each player's current rating, i.e. a live prediction of the outcome."}
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="players">
            <TabsList>
              <TabsTrigger value="players">Player ratings</TabsTrigger>
              <TabsTrigger value="matches">
                Match breakdown ({result.matches.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="players" className="mt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Edit any starting rating to recalculate instantly. Provisional
                  players start unrated (0) and are anchored to a base rating
                  from their results.
                </p>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  Tournament factor
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={factor}
                    onChange={(e) => setFactor(Number(e.target.value))}
                    className="h-8 w-20 text-right font-mono"
                    aria-label="Tournament factor (coefficient)"
                  />
                </label>
              </div>
              <ResultsTable
                results={result.players}
                startRatings={startRatings}
                onRatingChange={setRating}
                profileUrls={Object.fromEntries(
                  data.players.map((p) => [p.id, p.profileUrl]),
                )}
              />
            </TabsContent>
            <TabsContent value="matches" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Each match shows the integer points both players earned, based
                on their pre-tournament ratings. Points are summed per player,
                then scaled by weight and the tournament factor.
              </p>
              <MatchesTable matches={result.matches} />
            </TabsContent>
          </Tabs>
        </section>
      )}

      <VisitorsPanel />
    </main>
  )
}
