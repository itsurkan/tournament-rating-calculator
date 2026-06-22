"use client"

import { useEffect, useMemo, useState } from "react"
import type { TournamentResponse } from "@/lib/types"
import { calculateRatings, type Match, type PlayerInput } from "@/lib/rating"
import { ResultsTable } from "@/components/results-table"
import { MatchesTable } from "@/components/matches-table"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useI18n, type TKey } from "@/lib/i18n"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, MapPin, Calendar, Trophy, ChevronDown } from "lucide-react"
import { VisitorsPanel } from "@/components/visitors-panel"

const DEFAULT_RATING = 0 // provisional / unrated players start with no rating
const EXAMPLE = "https://ligas.io/tournament/2el6ef/results"

// Reduce any accepted input (a full ligas URL or a bare id) to the canonical
// short tournament id. The API caches the whole response per request URL, so a
// bare id and a full URL would be two separate cache keys for the same
// tournament — and one can go stale (e.g. cached before the event was
// processed). Always fetching by the bare id keeps a single, consistent cache
// entry whether the page is opened via ?t=<id> or recalculated from the URL box.
function tournamentIdFromInput(input: string): string {
  const match = input.match(/tournament\/([a-z0-9]+)/i)
  return match ? match[1] : input.trim()
}

// Recently viewed tournaments shown in the left panel.
const RECENTS_KEY = "recentTournaments"
const MAX_RECENTS = 20
type RecentItem = {
  id: string
  url: string
  name: string
  orgName: string | null
  viewedAt: number
}

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
  const [filterPlayerId, setFilterPlayerId] = useState("")
  const [recents, setRecents] = useState<RecentItem[]>([])
  const [recentsOpen, setRecentsOpen] = useState(false)

  // Every tournament the user has viewed, newest first, persisted locally so the
  // left panel survives reloads. The first entry is auto-loaded on mount (and is
  // served instantly from Vercel's edge cache).
  function addRecent(tour: TournamentResponse["tournament"]) {
    setRecents((prev) => {
      const item: RecentItem = {
        id: tour.id,
        url: tour.url,
        name: tour.name,
        orgName: tour.orgName ?? null,
        viewedAt: Date.now(),
      }
      const next = [item, ...prev.filter((r) => r.id !== tour.id)].slice(0, MAX_RECENTS)
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      } catch {
        // localStorage unavailable (private mode) — non-fatal
      }
      return next
    })
  }

  function clearRecents() {
    setRecents([])
    try {
      localStorage.removeItem(RECENTS_KEY)
    } catch {
      // non-fatal
    }
  }

  async function runCalculate(input: string) {
    const target = tournamentIdFromInput(input.trim())
    if (!target) return
    setErrorKey(null)
    setLoading(true)
    setData(null)
    setFilterPlayerId("")
    try {
      const res = await fetch(`/api/tournament?id=${encodeURIComponent(target)}`)
      const json = await res.json()
      if (!res.ok) {
        setErrorKey(toErrorKey(json?.code))
        return
      }
      const payload = json as TournamentResponse
      const ratings: Record<string, number> = {}
      for (const p of payload.players) {
        ratings[p.id] = p.ranking != null ? Math.round(p.ranking * 100) / 100 : DEFAULT_RATING
      }
      setStartRatings(ratings)
      setData(payload)
      setUrl(payload.tournament.url)
      addRecent(payload.tournament)
      // Reflect the loaded tournament in the page URL so it can be shared,
      // bookmarked, or reopened directly (?t=<id>).
      try {
        window.history.replaceState(null, "", `?t=${payload.tournament.id}`)
      } catch {
        // history unavailable — non-fatal
      }
    } catch {
      setErrorKey("error.unknown")
    } finally {
      setLoading(false)
    }
  }

  function handleCalculate(e?: React.FormEvent) {
    e?.preventDefault()
    void runCalculate(url)
  }

  // On first mount, restore the recents list for the panel. Only auto-load a
  // tournament when one is named in the URL (?t=<id>) — a bare "/" stays empty.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as RecentItem[]
        if (Array.isArray(stored) && stored.length > 0) setRecents(stored)
      }
    } catch {
      // ignore corrupt/unavailable storage
    }

    let initial: string | null = null
    try {
      initial = new URLSearchParams(window.location.search).get("t")
    } catch {
      initial = null
    }
    if (initial) {
      setUrl(initial)
      void runCalculate(initial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const filteredMatches = useMemo(() => {
    if (!result) return []
    if (!filterPlayerId) return result.matches
    return result.matches.filter(
      (m) => m.winnerId === filterPlayerId || m.loserId === filterPlayerId,
    )
  }, [result, filterPlayerId])

  const matchProfileUrls = useMemo(
    () =>
      data
        ? Object.fromEntries(data.players.map((p) => [p.id, p.profileUrl]))
        : {},
    [data],
  )

  function setRating(id: string, value: number) {
    setStartRatings((prev) => ({ ...prev, [id]: value }))
  }

  const activeId = data?.tournament.id ?? null

  function selectRecent(r: RecentItem, afterSelect?: () => void) {
    setUrl(r.url)
    void runCalculate(r.url)
    afterSelect?.()
  }

  // Shared list of recent tournaments — rendered in both the desktop sidebar and
  // the mobile collapsible panel. afterSelect lets the mobile panel close itself.
  function renderRecentsList(afterSelect?: () => void) {
    if (recents.length === 0) {
      return (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("recent.empty")}
        </p>
      )
    }
    return (
      <ul className="flex flex-col gap-1">
        {recents.map((r) => {
          const active = r.id === activeId
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => selectRecent(r, afterSelect)}
                className={`flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/10"
                    : "border-transparent hover:border-border hover:bg-card"
                }`}
              >
                <span className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
                  {r.name}
                </span>
                {r.orgName && (
                  <span className="truncate text-xs text-muted-foreground">
                    {r.orgName}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-8 px-4 py-10 md:py-16">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {t("recent.title")}
            </h2>
            {recents.length > 0 && (
              <button
                type="button"
                onClick={clearRecents}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {t("recent.clear")}
              </button>
            )}
          </div>
          {renderRecentsList()}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
      <header className="mb-8">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {t("header.eyebrow")}
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
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

      {recents.length > 0 && (
        <div className="mt-6 lg:hidden">
          <button
            type="button"
            onClick={() => setRecentsOpen((open) => !open)}
            aria-expanded={recentsOpen}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-card/80"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {t("recent.title")}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {recents.length}
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                recentsOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {recentsOpen && (
            <div className="mt-2">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearRecents}
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("recent.clear")}
                </button>
              </div>
              {renderRecentsList(() => setRecentsOpen(false))}
            </div>
          )}
        </div>
      )}

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
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  {t("matches.filterLabel")}
                  <select
                    value={filterPlayerId}
                    onChange={(e) => setFilterPlayerId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">{t("matches.filterAll")}</option>
                    {result.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {filterPlayerId && (
                  <button
                    type="button"
                    onClick={() => setFilterPlayerId("")}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {t("matches.filterClear")}
                  </button>
                )}
              </div>
              <MatchesTable
                matches={filteredMatches}
                highlightId={filterPlayerId || undefined}
                profileUrls={matchProfileUrls}
              />
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
      <VisitorsPanel />
      </main>
    </div>
  )
}
