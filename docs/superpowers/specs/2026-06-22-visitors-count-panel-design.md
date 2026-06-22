# Visitors Count Panel — Design

**Date:** 2026-06-22
**Status:** Approved (pending spec review)
**Target:** `main` branch (Vercel deployment)

## Goal

Add a small public panel to the Ligas Rating Calculator showing visit counts for
the current day, week, month, and year. Counts persist across serverless cold
starts and deploys.

## Decisions

| Question | Decision |
|----------|----------|
| Storage | Vercel KV / Upstash Redis (`@upstash/redis` client) |
| Visit metric | Every page load (no unique-visitor dedup) |
| Period definition | Calendar periods — today / this week / this month / this year |
| Time zone for bucketing | UTC (Vercel server time) |
| Visibility | Public — visible to all visitors |
| Placement | Bottom of page, footer-style |
| Window type | Calendar-period counters (not rolling 7/30/365-day windows) |
| Credentials | Env vars added in Vercel later; build with graceful degradation |

This revisits a feature previously designed (`2026-06-17`) and removed along with
its Redis dependency (commit `7c67378`). The approach is the same calendar-period
counter model, rebuilt cleanly on the current `main`.

## Storage Model

On each page load the API increments four calendar-period counters plus a
lifetime total, in a single Redis pipeline (O(1) writes — each `INCR` is
individually atomic; the pipeline batches round-trips but is not a transaction):

- `visits:day:<YYYY-MM-DD>` — e.g. `visits:day:2026-06-22`
- `visits:week:<YYYY-Www>` — ISO week, e.g. `visits:week:2026-W26`
- `visits:month:<YYYY-MM>` — e.g. `visits:month:2026-06`
- `visits:year:<YYYY>` — e.g. `visits:year:2026`
- `visits:total` — lifetime (kept for future use, not displayed)

Reading the panel = the same pipeline returns the four post-increment values, so
no separate read round-trip and no range-summing of daily keys. Both read and
write stay O(1).

Key derivation uses UTC. A small pure helper builds the keys from a `Date`, so
the date math is unit-testable in isolation.

### Why calendar periods, not rolling windows

"Today / this week / this month / this year" is the natural reading of the
request and lets each period be a single counter. Rolling windows (last 7/30/365
days) would require maintaining ~365 daily keys and summing them on every read —
more Redis traffic for marginal benefit. Out of scope.

## Components

### `lib/visits.ts` — counting logic (server-only)

- `periodKeys(date: Date): { day, week, month, year, total }` — pure function,
  derives the Redis keys from a date in UTC. Unit-testable, no I/O.
- `getRedis()` — lazily constructs an `@upstash/redis` client from env, or
  returns `null` if credentials are absent. Reads `KV_REST_API_URL` /
  `KV_REST_API_TOKEN` first, then `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` as a fallback.
- `recordVisit(date): Promise<VisitCounts | null>` — increments the four period
  keys + total via pipeline and returns the new `{ day, week, month, year }`.
  Returns `null` when Redis is unavailable (graceful degradation).

`VisitCounts` type: `{ day: number; week: number; month: number; year: number }`.

### `app/api/visits/route.ts` — API endpoint

- `POST` → calls `recordVisit(new Date())`, returns `VisitCounts` JSON, or
  `{ day: null, week: null, month: null, year: null }` when Redis is
  unavailable (HTTP 200 either way — a missing counter is not a user-facing
  error).
- `export const runtime = "nodejs"` and `dynamic = "force-dynamic"` so it is
  never statically cached.

### `components/visitors-panel.tsx` — UI (client component)

- On mount (`useEffect`), `POST`s to `/api/visits` once and stores the result.
- Renders a small muted footer card (matching the existing theme, optionally a
  `lucide-react` icon) with four compact stats labelled
  **Сьогодні · Цей тиждень · Цей місяць · Цей рік** via the existing
  `lib/i18n` (with English equivalents).
- States: loading (subtle skeleton/placeholder), loaded (formatted numbers via
  `toLocaleString()`), and unavailable (renders `—` for each value — no error
  banner).

### `app/page.tsx` — integration

- Render `<VisitorsPanel />` at the bottom of `<main>`, after the results
  section, footer-style (muted, smaller text, separated by spacing/border).

## Data Flow

```
page load → VisitorsPanel mounts → POST /api/visits
          → recordVisit(now) → Redis pipeline INCR(day,week,month,year,total)
          → returns {day,week,month,year} → panel renders the four stats
```

## i18n

Add four label keys to `lib/i18n` (uk + en):
- `visits.today` / `visits.week` / `visits.month` / `visits.year`
- optionally a heading key, e.g. `visits.heading`.

## Error Handling / Degradation

- Missing env vars → `getRedis()` returns `null` → `recordVisit` returns `null`
  → API returns nulls → panel shows `—`. No throw, no error UI. This is the
  expected local-dev state until KV creds are pulled.
- Redis call failure (network/timeout) → caught in `recordVisit`, logged
  server-side, returns `null` → same `—` rendering.
- Fetch failure in the client → caught, panel shows `—`.

## Testing

- Unit test `periodKeys()` for known dates, including ISO-week edge cases
  (year boundary where the ISO week belongs to the adjacent year, e.g.
  2026-01-01 / 2025-12-29) and month/day zero-padding.
- `recordVisit()` returning `null` when `getRedis()` is `null` (no env).
- Manual: with creds, load the page and confirm counters increment and the
  panel renders.

## Setup (documented in README)

1. Add the Upstash (or Vercel KV) integration to the Vercel project.
2. `vercel env pull .env.local` to get `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. `pnpm add @upstash/redis` (project uses pnpm — use `corepack pnpm@10`).
4. Deploy. Until env vars exist the panel quietly shows `—`.

## Out of Scope (YAGNI)

- Unique-visitor dedup (every page load is counted).
- Rolling-window counts (last 7/30/365 days).
- Per-page or per-route breakdowns.
- Admin/owner-only view (panel is public).
- Charts/historical graphs.
- Bot filtering.
