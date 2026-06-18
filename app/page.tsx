"use client"

import { useMemo, useState } from "react"
import type { TournamentResponse } from "@/lib/types"
import { fetchTournament, LigasError } from "@/lib/ligas"
import { calculateRatings, type Match, type PlayerInput } from "@/lib/rating"
import { ResultsTable } from "@/components/results-table"
import { MatchesTable } from "@/components/matches-table"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n, type TKey } from "@/lib/i18n"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, MapPin, Calendar, Trophy } from "lucide-react"

const DEFAULT_RATING = 0 // provisional / unrated players start with no rating
const EXAMPLE = "https://ligas.io/tournament/2el6ef/results"

// The API reports failures as stable codes; map them to known dictionary keys.
const ERROR_KEYS = new Set<TKey>([
  "error.no_tournament_id",
  "error.fetch_failed",
  "error.unknown",
])
function toErrorKey(code: unknown): TKey {
  const key = `error.${code}` as TKey
  return ERROR_KEYS.has(key) ? key : "error.unknown"
}

export default function Page() {
  const { t } = useI18n()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorKey, setErrorKey] = useState<TKey | null>(null)
  const [data, setData] = useState<TournamentResponse | null>(null)
  const [startRatings, setStartRatings] = useState<Record<string, number>>({})
  const [factor, setFactor] = useState(1)

  async function handleCalculate(e?: React.FormEvent) {
    e?.preventDefault()
    setErrorKey(null)
    setLoading(true)
    setData(null)
    try {
      const payload = await fetchTournament(url)
      const ratings: Record<string, number> = {}
      for (const p of payload.players) {
        ratings[p.id] = p.ranking != null ? Math.round(p.ranking * 100) / 100 : DEFAULT_RATING
      }
      setStartRatings(ratings)
      setData(payload)
    } catch (err) {
      setErrorKey(toErrorKey(err instanceof LigasError ? err.code : undefined))
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
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {t("header.eyebrow")}
          </div>
          <LanguageSwitcher />
        </div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {t("header.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          {t("header.intro")}
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
          aria-label={t("form.urlLabel")}
        />
        <Button type="submit" disabled={loading || !url.trim()} className="h-11 px-6">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("form.calculating")}
            </>
          ) : (
            t("form.calculate")
          )}
        </Button>
      </form>

      <div className="mt-2 text-sm text-muted-foreground">
        {t("form.tryExample")}{" "}
        <button
          type="button"
          onClick={() => setUrl(EXAMPLE)}
          className="font-mono text-primary underline-offset-4 hover:underline"
        >
          {EXAMPLE}
        </button>
      </div>

      {errorKey && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t(errorKey)}
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
                  <span>{t("tournament.players", { n: data.players.length })}</span>
                  <span>{t("tournament.matches", { n: data.matches.length })}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {data.tournament.processed
                    ? t("tournament.processed")
                    : t("tournament.unprocessed")}
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="players">
            <TabsList>
              <TabsTrigger value="players">{t("tabs.players")}</TabsTrigger>
              <TabsTrigger value="matches">
                {t("tabs.matches", { n: result.matches.length })}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="players" className="mt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t("players.help")}
                </p>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  {t("players.factor")}
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={factor}
                    onChange={(e) => setFactor(Number(e.target.value))}
                    className="h-8 w-20 text-right font-mono"
                    aria-label={t("players.factorAria")}
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
                {t("matches.help")}
              </p>
              <MatchesTable matches={result.matches} />
            </TabsContent>
          </Tabs>
        </section>
      )}

      <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
        {t("footer.createdBy")} &middot;{" "}
        <a
          href="https://t.me/Itsurkan"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          @Itsurkan
        </a>
      </footer>
    </main>
  )
}
