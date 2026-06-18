# GitHub Pages Migration — Design

Date: 2026-06-18
Branch: `feat/github-pages` (off `origin/main`; never merged to `main`)

## Goal

Serve the tournament rating calculator from GitHub Pages at
`https://itsurkan.github.io/tournament-rating-calculator/`, fully decoupled
from Vercel, at $0/mo.

## The core constraint

The app is a Next.js static UI plus **one** server route, `POST /api/tournament`
(`app/api/tournament/route.ts`). The rating math already runs in the browser
(`lib/rating.ts`); the route's only jobs are (a) fetching from `https://ligas.io/api`
and (b) fanning out per-player ranking-history lookups.

GitHub Pages serves **static files only** — no Node runtime — so that route
cannot exist. The naive fix ("fetch ligas.io straight from the browser") fails
because **ligas.io sends no CORS headers** (verified: `GET /api/tournaments/{id}`
returns `200` with no `access-control-allow-origin`). The server route is
silently doing CORS-bypass duty today.

Therefore a **proxy** is required, hosted somewhere that isn't Pages.

## Decisions

- **Proxy:** Cloudflare Worker, **pass-through** (not orchestrating). The browser
  does the orchestration; the Worker forwards one ligas call per request. This
  keeps each Worker invocation at 1 subrequest, far under Cloudflare's free
  50-subrequests-per-invocation cap that an orchestrating Worker would blow
  through on large tournaments.
- **Deploy:** Classic **`gh-pages` branch**. Pages source = "Deploy from a branch"
  → `gh-pages` `/`. GitHub's built-in pages builder serves it; our workflow only
  builds and pushes `out/`. No `github-pages` environment branch-policy tweak
  needed.
- **Trigger:** push to `feat/github-pages` + manual `workflow_dispatch`.
- **Branch hygiene:** all work on `feat/github-pages`; `main` is never modified.

## Architecture / data flow

```
Browser (static, on github.io)
  │  fetchTournament(url)  — orchestration in lib/ligas.ts
  ▼
Cloudflare Worker  https://<worker>.workers.dev/<ligas-path>
  │  forwards to https://ligas.io/api/<ligas-path>, adds CORS headers
  ▼
ligas.io API
```

## Components

### 1. Static export — `next.config.mjs`
```js
output: 'export',
basePath: '/tournament-rating-calculator',
trailingSlash: true,
images: { unoptimized: true },   // already present
typescript: { ignoreBuildErrors: true },  // already present
```
Build emits `out/`. No SSR/ISR is used and `app/page.tsx` is already
`"use client"`, so export is clean once the API route is removed.

### 2. Browser-side orchestration — new `lib/ligas.ts`
- Export `fetchTournament(url: string): Promise<TournamentResponse>`.
- A near-verbatim port of `app/api/tournament/route.ts`: `parseTournamentId`,
  `getJson`, `asArray`, `readRanking`, `num`, `readSnapshot`, roster build,
  per-player snapshot fan-out, match parsing — returning the **same**
  `TournamentResponse` shape (`{ tournament, players, matches }`).
- `getJson(path)` hits the proxy: `fetch(`${PROXY_BASE}/${path}`)` where
  `PROXY_BASE = process.env.NEXT_PUBLIC_PROXY_URL`. The `path` is the ligas API
  path **without** the `https://ligas.io/api` prefix (the Worker adds it).
- On failure, throw an `Error` with a user-facing message; `page.tsx` catches it.

### 3. Wire-up — `app/page.tsx`
- Replace the `fetch("/api/tournament", { method: "POST", body })` block with
  `const data = await fetchTournament(url)`.
- Keep existing loading/error state handling; map a thrown error to the existing
  `error` state string.

### 4. Remove server + Vercel bits
- **Delete** `app/api/tournament/route.ts` (and the now-empty `app/api/` dir).
- Remove `@vercel/analytics` import/usage from `app/layout.tsx`.
- Remove `@vercel/analytics` from `package.json` dependencies.
- Keep the `hono` pnpm override (unrelated lockfile fix).

### 5. Cloudflare Worker — new `worker/`
- `worker/index.js`: a locked pass-through proxy.
  - Route: `GET https://<worker>/<path>` → `https://ligas.io/api/<path>`.
  - **Only** ever prefixes `https://ligas.io/api` — it is NOT an open proxy and
    cannot be coerced into fetching arbitrary hosts.
  - Adds `Access-Control-Allow-Origin` restricted to
    `https://itsurkan.github.io` and `http://localhost:3000`; handles `OPTIONS`
    preflight; passes through `accept: application/json`.
  - Forwards GET only.
- `worker/wrangler.toml`: worker name `tournament-rating-proxy`, a recent
  `compatibility_date`.
- Deployed manually once by the user (`wrangler login && wrangler deploy`); the
  resulting URL feeds `NEXT_PUBLIC_PROXY_URL`.

### 6. Deploy workflow — new `.github/workflows/deploy-pages.yml`
- Triggers: `push` to `feat/github-pages`, plus `workflow_dispatch`.
- Permissions: `contents: write` (to push `gh-pages`).
- Steps:
  1. `actions/checkout`
  2. `actions/setup-node` (Node 20)
  3. `corepack enable && corepack prepare pnpm@10 --activate`
  4. `pnpm install --frozen-lockfile`
  5. `pnpm build` with `NEXT_PUBLIC_PROXY_URL` from a repo Actions **variable**
     (`vars.NEXT_PUBLIC_PROXY_URL`)
  6. `touch out/.nojekyll` (so Jekyll doesn't drop `_next/`)
  7. `JamesIves/github-pages-deploy-action` → `folder: out`, `branch: gh-pages`
- After the first successful run, set repo Pages source to `gh-pages` `/` via
  `gh api -X PUT /repos/itsurkan/tournament-rating-calculator/pages`.

## Environment / config

- **`NEXT_PUBLIC_PROXY_URL`** — the Worker URL. Set as a GitHub Actions repo
  variable for CI builds, and in a local `.env.local` for `pnpm dev`. Local dev
  uses the same deployed Worker (it allows the `localhost:3000` origin), or
  `wrangler dev` for an offline Worker.

## Sequencing (has one human-in-the-loop step)

1. Implement everything on `feat/github-pages` (config, `lib/ligas.ts`, page
   wire-up, route deletion, worker, workflow).
2. **User:** create a free Cloudflare account, `wrangler login`, `wrangler deploy`
   the Worker → provide the Worker URL.
3. Set `vars.NEXT_PUBLIC_PROXY_URL` (via `gh api`/`gh variable set`), push the
   branch → workflow builds and publishes to `gh-pages`.
4. Switch Pages source to `gh-pages` `/`; verify the live URL.

## Verification

- Local: `pnpm build` succeeds and produces `out/index.html` + `out/_next/`.
- Local: `pnpm dev` with `.env.local` → paste a known ligas tournament URL →
  results render and match ligas' official numbers for an already-processed
  tournament (per the ligas-rating-system notes).
- Worker: `curl https://<worker>/tournaments/<id>` returns the same JSON as
  `https://ligas.io/api/tournaments/<id>`, with an `access-control-allow-origin`
  header.
- Live: the `gh-pages` URL loads, a tournament lookup succeeds end-to-end, and
  the browser Network tab shows calls going to the Worker (not ligas.io directly).

## Out of scope / non-goals

- Removing Vercel deployment config from the Vercel dashboard (the user manages
  that; this design just stops depending on Vercel).
- Caching/rate-limiting in the Worker (can be added later if ligas load is a
  concern).
- Pre-rendering tournament data at build time (the app is interactive — the user
  supplies a tournament URL at runtime).

## Risks

- **ligas.io changes its API shape** — already a risk today; unchanged by this
  migration (same calls, just from the browser).
- **Worker cold latency / Cloudflare free-tier limits** — pass-through keeps us
  to 1 subrequest/call and well under the 100k req/day free quota for a personal
  tool.
- **`basePath` asset issues** — mitigated by `trailingSlash: true` and
  `.nojekyll`; verified by checking `out/_next/` loads on the live URL.
