# GitHub Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the tournament rating calculator from GitHub Pages (`https://itsurkan.github.io/tournament-rating-calculator/`), fully off Vercel, at $0/mo.

**Architecture:** Convert the Next.js app to a static export. The single server route (`/api/tournament`) is replaced by browser-side orchestration in `lib/ligas.ts`. Because ligas.io sends no CORS headers, the browser routes its ligas calls through a Cloudflare Worker pass-through proxy. A GitHub Actions workflow builds the static `out/` and publishes it to a `gh-pages` branch, which GitHub Pages serves.

**Tech Stack:** Next.js 16 (App Router, `output: 'export'`), pnpm 10 (via corepack), Cloudflare Workers (wrangler), GitHub Actions, `JamesIves/github-pages-deploy-action`.

**Note on verification:** this project has no unit-test framework (none in `package.json`, and the original route had no tests). Adding one is out of scope. Each task is therefore verified with concrete build/`curl`/runtime checks rather than unit tests — these are the real signals for a config + logic-port + infra migration.

## Global Constraints

- **Package manager:** always `corepack pnpm@10 …` — never bare `pnpm`/pnpm 11 (it corrupts the lockfile by dropping the `hono` override).
- **Branch:** all work on `feat/github-pages` (already created off `origin/main`). NEVER commit to or merge into `main`.
- **Repo:** `itsurkan/tournament-rating-calculator` (public). Pages URL: `https://itsurkan.github.io/tournament-rating-calculator/`.
- **basePath:** `/tournament-rating-calculator` (served under the repo subpath).
- **Proxy contract:** Worker forwards `GET https://<worker>/<path>` → `https://ligas.io/api/<path>`. `NEXT_PUBLIC_PROXY_URL` = the Worker base URL, no trailing slash, no `/api`.
- **Error-code contract:** the UI maps error codes to i18n keys via `error.<code>`; valid codes are `no_tournament_id`, `fetch_failed`, `unknown` (see `lib/i18n.tsx`). Preserve these exactly.

## File Structure

- Create `lib/ligas.ts` — browser-side ligas client (port of the deleted route).
- Modify `app/page.tsx` — call `fetchTournament` instead of `fetch("/api/tournament")`.
- Delete `app/api/tournament/route.ts` (+ the empty `app/api/` dir).
- Modify `package.json` — remove unused `@vercel/analytics`.
- Modify `next.config.mjs` — static export config.
- Create `worker/index.js`, `worker/wrangler.toml` — pass-through proxy.
- Create `.github/workflows/deploy-pages.yml` — build + publish to `gh-pages`.
- Create `.env.local.example` — document `NEXT_PUBLIC_PROXY_URL`.
- Modify `.gitignore` — ignore `/out/`.

---

## Task 1: Replace the server route with a browser-side ligas client

**Files:**
- Create: `lib/ligas.ts`
- Modify: `app/page.tsx:4` (imports) and `app/page.tsx:43-66` (the `try/catch` in `handleCalculate`)
- Modify: `package.json:13` (remove `@vercel/analytics`)
- Delete: `app/api/tournament/route.ts`

**Interfaces:**
- Consumes: `TournamentResponse` from `@/lib/types`; `toErrorKey` already in `app/page.tsx`.
- Produces:
  - `fetchTournament(input: string): Promise<TournamentResponse>`
  - `class LigasError extends Error { code: LigasErrorCode }`
  - `type LigasErrorCode = "no_tournament_id" | "fetch_failed"`

- [ ] **Step 1: Create `lib/ligas.ts`** with the full ported client:

```ts
// Browser-side ligas.io client.
//
// On GitHub Pages there is no server, and ligas.io sends no CORS headers, so the
// browser cannot call ligas.io directly. Every request goes through a Cloudflare
// Worker pass-through proxy (NEXT_PUBLIC_PROXY_URL) that forwards `/<path>` to
// `https://ligas.io/api/<path>` and adds CORS headers.
//
// This is a faithful port of the former `app/api/tournament/route.ts`; it returns
// the same TournamentResponse shape so the UI is unchanged.
import type { TournamentResponse } from "@/lib/types"

// Proxy base, e.g. https://tournament-rating-proxy.<sub>.workers.dev (no trailing
// slash, no /api). `${LIGAS}/tournaments/x` -> proxy -> ligas.io/api/tournaments/x
const LIGAS = (process.env.NEXT_PUBLIC_PROXY_URL ?? "").replace(/\/+$/, "")

/** Error codes the UI maps to i18n keys via `error.<code>`. */
export type LigasErrorCode = "no_tournament_id" | "fetch_failed"

export class LigasError extends Error {
  code: LigasErrorCode
  constructor(code: LigasErrorCode) {
    super(code)
    this.code = code
    this.name = "LigasError"
  }
}

// Extract the short tournament id from any ligas.io tournament URL or a raw id.
// e.g. https://ligas.io/tournament/2el6ef/results -> "2el6ef"
function parseTournamentId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const match = trimmed.match(/tournament\/([a-z0-9]+)/i)
  if (match) return match[1]
  if (/^[a-z0-9]{4,12}$/i.test(trimmed)) return trimmed
  return null
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`ligas ${res.status} for ${url}`)
  return res.json()
}

function asArray(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.data)) return obj.data
  }
  return []
}

// The org user profile is an object with a `fields` array of {key, value} pairs.
function readRanking(profile: any): number | null {
  const fields = Array.isArray(profile?.fields) ? profile.fields : []
  const found = fields.find((f: any) => f?.key === "ranking")
  if (!found) return null
  const value = typeof found.value === "number" ? found.value : Number(found.value)
  return Number.isFinite(value) && value > 0 ? value : null
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

type Ranking = { shortId: string; alias: string | null }

type Snapshot = {
  rating: number | null
  weight: number
  processed: boolean
  rankingAlias: string | null
}

// The rating/weight to use as this player's starting point for the tournament.
//   - If THIS tournament is already in the player's history, use the PRE-tournament
//     values ligas used (reproduce its official result).
//   - Otherwise use the player's CURRENT rating (latest history entry's `final`).
async function readSnapshot(
  alias: string,
  rankings: Ranking[],
  pid: string,
  tournamentId: string,
): Promise<Snapshot | null> {
  const entries: Array<any & { _rankingAlias: string | null }> = []
  await Promise.all(
    rankings.map(async (r) => {
      try {
        const hist = asArray(
          await getJson(`${LIGAS}/organizations/${alias}/rankings/${r.shortId}/participants/${pid}`),
        )
        for (const e of hist) entries.push({ ...e, _rankingAlias: r.alias })
      } catch {
        // player not in this ranking — ignore
      }
    }),
  )
  if (entries.length === 0) return null

  const own = entries.find((e) => e?.id === tournamentId)
  if (own) {
    return {
      rating: num(own.initial),
      weight: num(own.initialWeight) ?? 0,
      processed: true,
      rankingAlias: own._rankingAlias,
    }
  }

  const entryTime = (e: any) => Date.parse(e?.actualDate ?? e?.date ?? "") || 0
  let latest: any = entries[0]
  for (const e of entries) {
    if (entryTime(e) >= entryTime(latest)) latest = e
  }
  return {
    rating: num(latest?.final),
    weight: num(latest?.finalWeight) ?? 0,
    processed: false,
    rankingAlias: latest?._rankingAlias ?? null,
  }
}

export async function fetchTournament(input: string): Promise<TournamentResponse> {
  const id = parseTournamentId(input)
  if (!id) throw new LigasError("no_tournament_id")

  try {
    if (!LIGAS) throw new Error("NEXT_PUBLIC_PROXY_URL is not set")

    const [tournament, gamesRaw, standingRaw] = await Promise.all([
      getJson(`${LIGAS}/tournaments/${id}`),
      getJson(`${LIGAS}/tournaments/${id}/games`),
      getJson(`${LIGAS}/tournaments/${id}/standing`),
    ])

    const orgAlias: string = tournament?.orgAlias ?? "uttf"
    const games = asArray(gamesRaw)
    const standing = asArray(standingRaw)

    const rosterMap = new Map<string, string>()
    for (const row of standing) {
      if (row?.id && row?.name) rosterMap.set(row.id, row.name)
    }
    if (rosterMap.size === 0) {
      for (const g of games) {
        if (g?.participant1) rosterMap.set(g.participant1, g.participant1Name ?? g.participant1)
        if (g?.participant2) rosterMap.set(g.participant2, g.participant2Name ?? g.participant2)
      }
    }

    const playerIds = Array.from(rosterMap.keys())

    const rankings: Ranking[] = asArray(
      await getJson(`${LIGAS}/organizations/${orgAlias}/rankings`).catch(() => []),
    )
      .map((r: any) => ({ shortId: r?.shortId, alias: r?.alias ?? null }))
      .filter((r): r is Ranking => typeof r.shortId === "string")

    const ratings = await Promise.all(
      playerIds.map(async (pid) => {
        try {
          const [profile, snap] = await Promise.all([
            getJson(`${LIGAS}/organizations/${orgAlias}/users/${pid}`).catch(() => null),
            readSnapshot(orgAlias, rankings, pid, id),
          ])
          const rating = snap ? snap.rating : readRanking(profile)
          return {
            id: pid,
            ranking: rating != null && rating > 0 ? rating : null,
            weight: snap?.weight ?? 0,
            processed: snap?.processed ?? false,
            rankingAlias: snap?.rankingAlias ?? null,
          }
        } catch {
          return { id: pid, ranking: null, weight: 0, processed: false, rankingAlias: null }
        }
      }),
    )

    const processed = ratings.some((r) => r.processed)
    const fallbackAlias = rankings[0]?.alias ?? null

    const players = playerIds.map((pid) => {
      const r = ratings.find((x) => x.id === pid)
      const rankingAlias = r?.rankingAlias ?? fallbackAlias
      return {
        id: pid,
        name: rosterMap.get(pid) ?? pid,
        ranking: r?.ranking ?? null,
        weight: r?.weight ?? 0,
        provisional: r?.ranking == null,
        profileUrl: rankingAlias
          ? `https://ligas.io/${orgAlias}/ranking/${rankingAlias}/participants/${pid}`
          : null,
      }
    })

    const matches = games
      .map((g) => {
        const result: string = g?.result ?? ""
        const m = result.match(/^(\d+)\s*:\s*(\d+)$/)
        if (!m) return null
        const s1 = Number(m[1])
        const s2 = Number(m[2])
        if (s1 === s2) return null
        const p1 = g?.participant1
        const p2 = g?.participant2
        if (!p1 || !p2) return null
        const winnerId = s1 > s2 ? p1 : p2
        const loserId = s1 > s2 ? p2 : p1
        const scoreFromWinner = s1 > s2 ? `${s1}:${s2}` : `${s2}:${s1}`
        return {
          gameId: g?.id ?? `${p1}-${p2}`,
          stageName: g?.stageName ?? "",
          winnerId,
          loserId,
          score: scoreFromWinner,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return {
      tournament: {
        id,
        name: tournament?.name ?? id,
        orgName: tournament?.orgName ?? null,
        orgAlias,
        location: tournament?.location ?? null,
        start: tournament?.start ?? null,
        format: tournament?.format ?? null,
        processed,
        url: `https://ligas.io/tournament/${id}/results`,
      },
      players,
      matches,
    }
  } catch (err) {
    if (err instanceof LigasError) throw err
    console.error("tournament fetch error:", (err as Error).message)
    throw new LigasError("fetch_failed")
  }
}
```

- [ ] **Step 2: Update `app/page.tsx` imports.** After line 4 (`import type { TournamentResponse } from "@/lib/types"`), add:

```ts
import { fetchTournament, LigasError } from "@/lib/ligas"
```

- [ ] **Step 3: Replace the `try/catch` body in `handleCalculate`.** Replace the current block (lines 43–65, from `try {` through the `finally` close) with:

```ts
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
```

- [ ] **Step 4: Delete the server route.**

```bash
git rm app/api/tournament/route.ts
rmdir app/api 2>/dev/null || true
```

- [ ] **Step 5: Remove the unused `@vercel/analytics` dependency** from `package.json`. Delete this line (currently line 13):

```json
    "@vercel/analytics": "1.6.1",
```

- [ ] **Step 6: Refresh the lockfile** (regenerates `pnpm-lock.yaml` without the removed dep, keeping the `hono` override):

```bash
corepack pnpm@10 install
```
Expected: completes; `pnpm-lock.yaml` updated; `node_modules` resolves.

- [ ] **Step 7: Verify the app still builds** (normal server build — the export config comes in Task 2):

```bash
corepack pnpm@10 build
```
Expected: build succeeds with no reference to `/api/tournament`, no type error from `lib/ligas.ts` or `app/page.tsx`. (`@vercel/analytics` being gone causes no error since nothing imported it.)

- [ ] **Step 8: Commit.**

```bash
git add lib/ligas.ts app/page.tsx package.json pnpm-lock.yaml
git rm --cached app/api/tournament/route.ts 2>/dev/null || true
git commit -m "feat: move ligas orchestration into the browser, drop /api route"
```

---

## Task 2: Enable Next.js static export

**Files:**
- Modify: `next.config.mjs` (whole file)
- Modify: `.gitignore` (add `/out/`)

**Interfaces:**
- Consumes: nothing (Task 1 removed the API route, which is required before `output: 'export'` will build).
- Produces: a static `out/` build directory served under basePath `/tournament-rating-calculator`.

- [ ] **Step 1: Replace `next.config.mjs`** with:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/tournament-rating-calculator',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
```

- [ ] **Step 2: Ignore the export output.** Append to `.gitignore` under the "generated / build artifacts" section:

```
/out/
```

- [ ] **Step 3: Build and verify the static export is produced.**

```bash
corepack pnpm@10 build && ls out/index.html out/_next >/dev/null && echo "EXPORT OK"
```
Expected: prints `EXPORT OK`. The build emits `out/` with `index.html` and a `_next/` directory. No "API Routes cannot be used with output: export" error (the route was deleted in Task 1).

- [ ] **Step 4: Commit.**

```bash
git add next.config.mjs .gitignore
git commit -m "build: configure Next.js static export for GitHub Pages"
```

---

## Task 3: Cloudflare Worker pass-through proxy

**Files:**
- Create: `worker/index.js`
- Create: `worker/wrangler.toml`

**Interfaces:**
- Consumes: nothing.
- Produces: a Worker that maps `GET https://<worker>/<path>` → `https://ligas.io/api/<path>` with CORS headers for `https://itsurkan.github.io` and `http://localhost:3000`. Its deployed URL becomes `NEXT_PUBLIC_PROXY_URL`.

- [ ] **Step 1: Create `worker/index.js`:**

```js
// Pass-through proxy for ligas.io. It ONLY ever forwards to https://ligas.io/api/*
// (never an arbitrary host), so it cannot be abused as an open proxy. Adds CORS
// headers so the static GitHub Pages site can read the responses.
const LIGAS = "https://ligas.io/api"
const ALLOWED_ORIGINS = new Set([
  "https://itsurkan.github.io",
  "http://localhost:3000",
])

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://itsurkan.github.io"
  return {
    "access-control-allow-origin": allow,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "accept, content-type",
    vary: "Origin",
  }
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") ?? ""

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(origin),
      })
    }

    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/+/, "") // strip leading slash(es)
    const target = `${LIGAS}/${path}${url.search}`

    const upstream = await fetch(target, {
      headers: { accept: "application/json" },
    })
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(origin),
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    })
  },
}
```

- [ ] **Step 2: Create `worker/wrangler.toml`:**

```toml
name = "tournament-rating-proxy"
main = "index.js"
compatibility_date = "2024-09-23"
```

- [ ] **Step 3: Sanity-check the Worker logic offline** (optional — requires no Cloudflare account; `wrangler` is fetched via npx). In `worker/`:

```bash
cd worker && npx --yes wrangler@latest dev --port 8787 &
sleep 6
curl -s "http://localhost:8787/tournaments/2el6ef" | head -c 200
curl -s -D - -o /dev/null -H "Origin: http://localhost:3000" "http://localhost:8787/tournaments/2el6ef" | grep -i access-control
kill %1 2>/dev/null
```
Expected: the JSON body matches `https://ligas.io/api/tournaments/2el6ef`, and the response carries `access-control-allow-origin: http://localhost:3000`. (If the user has no Cloudflare login yet, `wrangler dev` still runs locally without deploying.)

- [ ] **Step 4: Commit.**

```bash
git add worker/index.js worker/wrangler.toml
git commit -m "feat: add Cloudflare Worker pass-through proxy for ligas.io"
```

---

## Task 4: GitHub Actions deploy workflow + env docs

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Create: `.env.local.example`

**Interfaces:**
- Consumes: the static export from Task 2 (`out/`); the repo Actions variable `NEXT_PUBLIC_PROXY_URL` (set in Task 5).
- Produces: a workflow that publishes `out/` to the `gh-pages` branch on push to `feat/github-pages` or manual dispatch.

- [ ] **Step 1: Create `.github/workflows/deploy-pages.yml`:**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [feat/github-pages]
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: pages-deploy
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Enable pnpm 10
        run: |
          corepack enable
          corepack prepare pnpm@10 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build static export
        env:
          NEXT_PUBLIC_PROXY_URL: ${{ vars.NEXT_PUBLIC_PROXY_URL }}
        run: pnpm build

      - name: Disable Jekyll (keep _next/)
        run: touch out/.nojekyll

      - name: Publish to gh-pages
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: out
          branch: gh-pages
          single-commit: true
```

- [ ] **Step 2: Create `.env.local.example`:**

```
# URL of the Cloudflare Worker pass-through proxy.
# No trailing slash, no /api suffix.
# e.g. https://tournament-rating-proxy.<your-subdomain>.workers.dev
NEXT_PUBLIC_PROXY_URL=
```

- [ ] **Step 3: Validate the workflow YAML parses.**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy-pages.yml')); print('YAML OK')"
```
Expected: prints `YAML OK`.

- [ ] **Step 4: Commit.**

```bash
git add .github/workflows/deploy-pages.yml .env.local.example
git commit -m "ci: build static export and publish to gh-pages"
```

---

## Task 5: Deploy runbook — Worker, first publish, Pages source (collaborative)

**Files:** none (operational steps; some require the user's Cloudflare/GitHub auth).

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a live site at `https://itsurkan.github.io/tournament-rating-calculator/` served from `gh-pages`.

- [ ] **Step 1 (USER): Deploy the Worker.** With a free Cloudflare account:

```bash
cd worker
npx --yes wrangler@latest login      # opens browser for Cloudflare auth
npx --yes wrangler@latest deploy
```
Expected: prints the deployed URL, e.g. `https://tournament-rating-proxy.<subdomain>.workers.dev`. Copy it.

- [ ] **Step 2 (USER): Smoke-test the deployed Worker.**

```bash
curl -s "https://tournament-rating-proxy.<subdomain>.workers.dev/tournaments/2el6ef" | head -c 200
```
Expected: same JSON as `https://ligas.io/api/tournaments/2el6ef`.

- [ ] **Step 3: Set the proxy URL as a repo Actions variable** (substitute the real URL):

```bash
gh variable set NEXT_PUBLIC_PROXY_URL \
  --repo itsurkan/tournament-rating-calculator \
  --body "https://tournament-rating-proxy.<subdomain>.workers.dev"
gh variable list --repo itsurkan/tournament-rating-calculator
```
Expected: `NEXT_PUBLIC_PROXY_URL` listed.

- [ ] **Step 4: Push the branch to trigger the deploy workflow.**

```bash
git push -u origin feat/github-pages
gh run watch --repo itsurkan/tournament-rating-calculator
```
Expected: the "Deploy to GitHub Pages" run succeeds and a `gh-pages` branch now exists with the built site.

- [ ] **Step 5: Point GitHub Pages at the `gh-pages` branch.**

```bash
gh api -X PUT repos/itsurkan/tournament-rating-calculator/pages \
  -f "source[branch]=gh-pages" -f "source[path]=/"
gh api repos/itsurkan/tournament-rating-calculator/pages --jq '.html_url, .source'
```
Expected: `source` shows `gh-pages` `/`; `html_url` is `https://itsurkan.github.io/tournament-rating-calculator/`. (If Pages was previously set to the "GitHub Actions" build type, this switches it to "Deploy from a branch".)

- [ ] **Step 6: Verify the live site end-to-end.** Open `https://itsurkan.github.io/tournament-rating-calculator/`, paste a known tournament URL (`https://ligas.io/tournament/2el6ef/results`), and confirm:
  - results render, players + matches populate;
  - for an already-processed tournament, the "After" numbers match ligas' official values (per the ligas-rating-system notes);
  - the browser Network tab shows calls to the Worker URL (not ligas.io directly), all `200`, no CORS errors in the console;
  - `_next/` assets load (no 404s — confirms `.nojekyll` + basePath are correct).

- [ ] **Step 7: Set local dev env (optional, for future `pnpm dev`).**

```bash
cp .env.local.example .env.local
# edit .env.local: NEXT_PUBLIC_PROXY_URL=https://tournament-rating-proxy.<subdomain>.workers.dev
```
Expected: `corepack pnpm@10 dev` then a tournament lookup at `http://localhost:3000` works against the deployed Worker.

---

## Self-Review

**Spec coverage:**
- Static export → Task 2. ✓
- Browser orchestration / kill route → Task 1. ✓
- Remove `@vercel/analytics` → Task 1 (package.json only; no `layout.tsx` import exists on this branch, correcting the spec's note). ✓
- Cloudflare Worker pass-through → Task 3. ✓
- gh-pages deploy workflow → Task 4. ✓
- `NEXT_PUBLIC_PROXY_URL` config (CI var + `.env.local`) → Tasks 4 & 5. ✓
- Switch Pages source to gh-pages → Task 5 Step 5. ✓
- Verification (build, worker curl, live end-to-end) → Tasks 2/3/5. ✓

**Placeholder scan:** Remaining `<subdomain>` / `<worker>` tokens are real runtime values only known after the user deploys the Worker (Task 5 Step 1); every other step has concrete content. No TODO/TBD.

**Type consistency:** `fetchTournament(input: string): Promise<TournamentResponse>`, `LigasError.code: LigasErrorCode`, and `toErrorKey(err.code)` are consistent across `lib/ligas.ts` and `app/page.tsx`. Returned object matches `TournamentResponse` (`tournament`/`players`/`matches`) from `lib/types.ts`. Error codes (`no_tournament_id`, `fetch_failed`) match `lib/i18n.tsx` keys.
