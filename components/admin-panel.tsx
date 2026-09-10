"use client"

// Operator panel for the ligas cache: see / change the TTLs (persisted in
// Vercel Edge Config, no redeploy) and purge the cached player data on demand.
// Guarded by ADMIN_TOKEN — the token is kept in localStorage on this device only.
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Check, Loader2, RefreshCw, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const TOKEN_KEY = "adminToken"

type CacheConfig = { playerTtlS: number; rankingsTtlS: number }
type Status = { readable: boolean; writable: boolean }
type State = {
  config: CacheConfig
  source: "edge-config" | "default"
  defaults: CacheConfig
  status: Status
}

type Notice = { kind: "ok" | "error"; text: string } | null

const fmtDuration = (s: number) => {
  if (s === 0) return "0 (always fresh)"
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || `${s} s`
}

// The form edits hours with decimals (1.5 = 90 min); the API stores seconds.
const toHours = (s: number) => String(Math.round((s / 3600) * 100) / 100)
const toSeconds = (h: string) => Math.round(Number(h) * 3600)

export function AdminPanel() {
  const [token, setToken] = useState("")
  const [tokenLoaded, setTokenLoaded] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [playerH, setPlayerH] = useState("")
  const [rankingsH, setRankingsH] = useState("")
  const [busy, setBusy] = useState<"load" | "save" | "purge" | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [purgedAt, setPurgedAt] = useState<string | null>(null)

  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? "")
    } catch {
      // storage unavailable — the token just has to be typed each time
    }
    setTokenLoaded(true)
  }, [])

  const call = useCallback(
    async (method: "GET" | "PUT" | "DELETE", body?: unknown) => {
      const res = await fetch("/api/admin/cache", {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = json?.code
        const msg =
          code === "unauthorized"
            ? "Wrong token."
            : code === "admin_disabled"
              ? "Admin is disabled: ADMIN_TOKEN is not set on the server."
              : code === "not_writable"
                ? `Cannot save: ${json?.message ?? "Edge Config is not writable."}`
                : code === "invalid_config"
                  ? "Values must be between 0 and 720 hours."
                  : `Request failed (${res.status}).`
        throw new Error(msg)
      }
      return json
    },
    [token],
  )

  const load = useCallback(async () => {
    setBusy("load")
    setNotice(null)
    try {
      const s = (await call("GET")) as State
      setState(s)
      setPlayerH(toHours(s.config.playerTtlS))
      setRankingsH(toHours(s.config.rankingsTtlS))
      try {
        localStorage.setItem(TOKEN_KEY, token)
      } catch {
        // non-fatal
      }
    } catch (err) {
      setState(null)
      setNotice({ kind: "error", text: (err as Error).message })
    } finally {
      setBusy(null)
    }
  }, [call, token])

  // Auto-load once the stored token is known.
  useEffect(() => {
    if (tokenLoaded && token) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenLoaded])

  async function save() {
    setBusy("save")
    setNotice(null)
    try {
      const body = { playerTtlS: toSeconds(playerH), rankingsTtlS: toSeconds(rankingsH) }
      const res = (await call("PUT", body)) as { config: CacheConfig }
      setState((s) => (s ? { ...s, config: res.config, source: "edge-config" } : s))
      setNotice({
        kind: "ok",
        text: "Saved. New lookups use these TTLs; entries cached before keep their old expiry unless you clear the cache.",
      })
    } catch (err) {
      setNotice({ kind: "error", text: (err as Error).message })
    } finally {
      setBusy(null)
    }
  }

  async function purge() {
    setBusy("purge")
    setNotice(null)
    try {
      const res = (await call("DELETE")) as { at: string }
      setPurgedAt(res.at)
      setNotice({ kind: "ok", text: "Cache cleared. The next load re-fetches every player from ligas." })
    } catch (err) {
      setNotice({ kind: "error", text: (err as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const dirty =
    state != null &&
    (toSeconds(playerH) !== state.config.playerTtlS || toSeconds(rankingsH) !== state.config.rankingsTtlS)
  const canSave = state?.status.writable && dirty && busy == null

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Calculator
        </Link>
        <span className="text-sm font-bold uppercase tracking-[0.12em] text-primary">Admin</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access</CardTitle>
          <CardDescription>The ADMIN_TOKEN from the Vercel project settings. Stored only in this browser.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            type="password"
            autoComplete="off"
            placeholder="admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && token && void load()}
          />
          <Button onClick={() => void load()} disabled={!token || busy != null}>
            {busy === "load" ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Load
          </Button>
        </CardContent>
      </Card>

      {notice && (
        <p
          role="status"
          className={
            notice.kind === "ok"
              ? "rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300"
              : "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {notice.text}
        </p>
      )}

      {state && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Ligas cache TTL
                <Badge variant={state.source === "edge-config" ? "default" : "secondary"}>
                  {state.source === "edge-config" ? "Edge Config" : "defaults"}
                </Badge>
              </CardTitle>
              <CardDescription>
                How long a player&apos;s rating / weight and the org ranking list are reused before ligas is asked
                again. Tournament games are never cached. Hours, decimals allowed (0.5 = 30 min, 0 = always fresh).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Player history + profile</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={720}
                    step={0.25}
                    value={playerH}
                    onChange={(e) => setPlayerH(e.target.value)}
                    disabled={!state.status.writable}
                    className="max-w-32 font-mono"
                  />
                  <span className="text-muted-foreground">
                    h · now {fmtDuration(state.config.playerTtlS)} · default {fmtDuration(state.defaults.playerTtlS)}
                  </span>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Org ranking list</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={720}
                    step={0.25}
                    value={rankingsH}
                    onChange={(e) => setRankingsH(e.target.value)}
                    disabled={!state.status.writable}
                    className="max-w-32 font-mono"
                  />
                  <span className="text-muted-foreground">
                    h · now {fmtDuration(state.config.rankingsTtlS)} · default {fmtDuration(state.defaults.rankingsTtlS)}
                  </span>
                </div>
              </label>

              {!state.status.writable && (
                <p className="text-xs text-muted-foreground">
                  Read-only: to edit, create an Edge Config store, connect it to the project (sets{" "}
                  <code>EDGE_CONFIG</code>), and add <code>VERCEL_API_TOKEN</code> + <code>EDGE_CONFIG_ID</code>{" "}
                  (+ <code>VERCEL_TEAM_ID</code> on a team). See README.
                </p>
              )}
              {state.status.writable && !state.status.readable && (
                <p className="text-xs text-destructive">
                  Saving works but <code>EDGE_CONFIG</code> is not set, so the calculator will keep using the defaults.
                </p>
              )}

              <div>
                <Button onClick={() => void save()} disabled={!canSave}>
                  {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clear cache</CardTitle>
              <CardDescription>
                Drops every cached player history, profile and ranking list right now. Use it after ligas has
                processed a tournament and you want the official numbers immediately. The next load of each
                tournament re-fetches its players (throttled, retried).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Button variant="destructive" onClick={() => void purge()} disabled={busy != null}>
                {busy === "purge" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                Clear ligas cache
              </Button>
              {purgedAt && (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Check className="size-4" /> {new Date(purgedAt).toLocaleTimeString()}
                </span>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
