# Visitors Count Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public footer panel to the Ligas Rating Calculator showing visit counts for today / this week / this month / this year, persisted in Vercel KV (Upstash Redis).

**Architecture:** Each page load POSTs to a Next.js API route, which increments four calendar-period counters (+ a lifetime total) in a single Redis pipeline and returns the new values. A client component renders them. When KV env vars are absent, everything degrades gracefully to `—`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `@upstash/redis`, Vitest (new dev dependency for unit tests).

## Global Constraints

- Package manager: use `corepack pnpm@10` (pnpm 11 corrupts the lockfile — drops the `hono` override).
- Counts are **every page load**, no unique dedup.
- Periods are **calendar periods** in **UTC** (today / this ISO week / this month / this year), not rolling windows.
- All counting code in `lib/visits.ts` is **server-only** (never imported by a client component).
- The panel is **public** and must never throw on missing/failing KV — it shows `—` instead.
- UI strings go through `lib/i18n` (uk + en), uk is default locale.
- Read env `KV_REST_API_URL` / `KV_REST_API_TOKEN` first, then fall back to `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`.

---

### Task 1: Period-key helper + test harness

**Files:**
- Create: `lib/visits.ts`
- Create: `lib/visits.test.ts`
- Modify: `package.json` (add `vitest` devDep + `test` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type VisitCounts = { day: number; week: number; month: number; year: number }`
  - `export function periodKeys(date: Date): { day: string; week: string; month: string; year: string; total: string }`

- [ ] **Step 1: Add Vitest and test script**

Run:
```bash
corepack pnpm@10 add -D vitest
```

Then edit `package.json` `scripts` to add:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: { environment: "node" },
})
```

- [ ] **Step 3: Write the failing test** in `lib/visits.test.ts`

```ts
import { describe, expect, it } from "vitest"
import { periodKeys } from "@/lib/visits"

describe("periodKeys", () => {
  it("derives UTC calendar keys with zero-padding", () => {
    const k = periodKeys(new Date("2026-06-02T10:00:00Z"))
    expect(k.day).toBe("visits:day:2026-06-02")
    expect(k.month).toBe("visits:month:2026-06")
    expect(k.year).toBe("visits:year:2026")
    expect(k.total).toBe("visits:total")
  })

  it("uses ISO week numbering (mid-year)", () => {
    // 2026-06-22 is a Monday in ISO week 26
    const k = periodKeys(new Date("2026-06-22T00:00:00Z"))
    expect(k.week).toBe("visits:week:2026-W26")
  })

  it("handles ISO-week year boundary (week belongs to previous year)", () => {
    // 2026-01-01 (Thursday) is in ISO week 1 of 2026
    expect(periodKeys(new Date("2026-01-01T00:00:00Z")).week).toBe(
      "visits:week:2026-W01",
    )
    // 2021-01-01 (Friday) is in ISO week 53 of 2020
    expect(periodKeys(new Date("2021-01-01T12:00:00Z")).week).toBe(
      "visits:week:2020-W53",
    )
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `corepack pnpm@10 test`
Expected: FAIL — cannot resolve `periodKeys` / `lib/visits` has no such export.

- [ ] **Step 5: Implement `periodKeys` (and the type) in `lib/visits.ts`**

```ts
// Server-only visit counting. Do NOT import from a client component.
export type VisitCounts = {
  day: number
  week: number
  month: number
  year: number
}

const pad = (n: number) => String(n).padStart(2, "0")

// ISO-8601 week number + the year that week belongs to (may differ from the
// calendar year at the boundary). Algorithm: shift to the Thursday of the
// current ISO week, then count weeks from Jan 1 of that Thursday's year.
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
  const day = d.getUTCDay() || 7 // Sun=0 -> 7
  d.setUTCDate(d.getUTCDate() + 4 - day) // move to Thursday
  const year = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year, week }
}

export function periodKeys(date: Date) {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1)
  const d = pad(date.getUTCDate())
  const { year: wy, week } = isoWeek(date)
  return {
    day: `visits:day:${y}-${m}-${d}`,
    week: `visits:week:${wy}-W${pad(week)}`,
    month: `visits:month:${y}-${m}`,
    year: `visits:year:${y}`,
    total: `visits:total`,
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `corepack pnpm@10 test`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/visits.ts lib/visits.test.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat(visits): add periodKeys helper + vitest harness"
```

---

### Task 2: Redis client + recordVisit

**Files:**
- Modify: `lib/visits.ts`
- Modify: `lib/visits.test.ts`

**Interfaces:**
- Consumes: `periodKeys`, `VisitCounts` from Task 1.
- Produces:
  - `export function getRedis(): Redis | null`
  - `export async function recordVisit(date: Date): Promise<VisitCounts | null>`

- [ ] **Step 1: Add the dependency**

Run:
```bash
corepack pnpm@10 add @upstash/redis
```

- [ ] **Step 2: Write the failing test** — append to `lib/visits.test.ts`

```ts
import { recordVisit } from "@/lib/visits"

describe("recordVisit", () => {
  it("returns null when no Redis env is configured", async () => {
    const prev = {
      a: process.env.KV_REST_API_URL,
      b: process.env.KV_REST_API_TOKEN,
      c: process.env.UPSTASH_REDIS_REST_URL,
      d: process.env.UPSTASH_REDIS_REST_TOKEN,
    }
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    try {
      expect(await recordVisit(new Date())).toBeNull()
    } finally {
      if (prev.a) process.env.KV_REST_API_URL = prev.a
      if (prev.b) process.env.KV_REST_API_TOKEN = prev.b
      if (prev.c) process.env.UPSTASH_REDIS_REST_URL = prev.c
      if (prev.d) process.env.UPSTASH_REDIS_REST_TOKEN = prev.d
    }
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `corepack pnpm@10 test`
Expected: FAIL — `recordVisit` not exported.

- [ ] **Step 4: Implement `getRedis` + `recordVisit`** — append to `lib/visits.ts`

```ts
import { Redis } from "@upstash/redis"

export function getRedis(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function recordVisit(date: Date): Promise<VisitCounts | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const k = periodKeys(date)
    const pipe = redis.pipeline()
    pipe.incr(k.day)
    pipe.incr(k.week)
    pipe.incr(k.month)
    pipe.incr(k.year)
    pipe.incr(k.total)
    const [day, week, month, year] = (await pipe.exec()) as number[]
    return { day, week, month, year }
  } catch (err) {
    console.error("recordVisit failed", err)
    return null
  }
}
```

Put the `import { Redis }` line at the top of the file with the other imports.

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm@10 test`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add lib/visits.ts lib/visits.test.ts package.json pnpm-lock.yaml
git commit -m "feat(visits): add Redis client and recordVisit"
```

---

### Task 3: API route

**Files:**
- Create: `app/api/visits/route.ts`

**Interfaces:**
- Consumes: `recordVisit`, `VisitCounts` from Task 2.
- Produces: `POST /api/visits` → JSON `{ day, week, month, year }` (numbers, or all `null` when KV unavailable).

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server"
import { recordVisit } from "@/lib/visits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const counts = await recordVisit(new Date())
  if (!counts) {
    return NextResponse.json({ day: null, week: null, month: null, year: null })
  }
  return NextResponse.json(counts)
}
```

- [ ] **Step 2: Verify it builds and responds**

Run: `corepack pnpm@10 build`
Expected: build succeeds, `/api/visits` listed as a route (ƒ dynamic).

Then (optional manual check, no KV env locally):
```bash
corepack pnpm@10 dev &
sleep 4 && curl -s -X POST http://localhost:3000/api/visits
```
Expected: `{"day":null,"week":null,"month":null,"year":null}` (graceful degradation). Stop the dev server afterward.

- [ ] **Step 3: Commit**

```bash
git add app/api/visits/route.ts
git commit -m "feat(visits): add POST /api/visits route"
```

---

### Task 4: i18n strings

**Files:**
- Modify: `lib/i18n.tsx` (add keys to the `en` object ~line 16+ and the matching `uk` object ~line 72+)

**Interfaces:**
- Consumes: nothing.
- Produces: TKeys `visits.heading`, `visits.today`, `visits.week`, `visits.month`, `visits.year` available to `t()`.

- [ ] **Step 1: Add the English keys** to the `en` object in `lib/i18n.tsx` (add before its closing `}`):

```ts
  "visits.heading": "Visits",
  "visits.today": "Today",
  "visits.week": "This week",
  "visits.month": "This month",
  "visits.year": "This year",
```

- [ ] **Step 2: Add the matching Ukrainian keys** to the `uk` object in `lib/i18n.tsx`:

```ts
  "visits.heading": "Відвідування",
  "visits.today": "Сьогодні",
  "visits.week": "Цей тиждень",
  "visits.month": "Цей місяць",
  "visits.year": "Цей рік",
```

- [ ] **Step 3: Verify types compile**

Run: `corepack pnpm@10 exec tsc --noEmit`
Expected: no errors (uk is `Record<TKey, string>`, so any missing key would fail here).

- [ ] **Step 4: Commit**

```bash
git add lib/i18n.tsx
git commit -m "feat(visits): add i18n labels for visits panel"
```

---

### Task 5: Visitors panel component

**Files:**
- Create: `components/visitors-panel.tsx`

**Interfaces:**
- Consumes: `useI18n` from `@/lib/i18n`; `VisitCounts` shape from the API.
- Produces: `export function VisitorsPanel()` — default-importable React client component.

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { useI18n } from "@/lib/i18n"

type Counts = {
  day: number | null
  week: number | null
  month: number | null
  year: number | null
}

const EMPTY: Counts = { day: null, week: null, month: null, year: null }

export function VisitorsPanel() {
  const { t } = useI18n()
  const [counts, setCounts] = useState<Counts | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/visits", { method: "POST" })
      .then((r) => (r.ok ? r.json() : EMPTY))
      .then((data: Counts) => {
        if (active) setCounts(data)
      })
      .catch(() => {
        if (active) setCounts(EMPTY)
      })
    return () => {
      active = false
    }
  }, [])

  const fmt = (n: number | null | undefined) =>
    typeof n === "number" ? n.toLocaleString() : "—"

  const items: { key: string; label: string; value: number | null }[] = [
    { key: "day", label: t("visits.today"), value: counts?.day ?? null },
    { key: "week", label: t("visits.week"), value: counts?.week ?? null },
    { key: "month", label: t("visits.month"), value: counts?.month ?? null },
    { key: "year", label: t("visits.year"), value: counts?.year ?? null },
  ]

  return (
    <footer className="mt-10 border-t border-border pt-6 text-muted-foreground">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Users className="h-4 w-4" aria-hidden />
        <span>{t("visits.heading")}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.key} className="rounded-lg border border-border p-3">
            <dt className="text-xs">{it.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {counts === null ? (
                <span className="inline-block h-5 w-12 animate-pulse rounded bg-muted" />
              ) : (
                fmt(it.value)
              )}
            </dd>
          </div>
        ))}
      </dl>
    </footer>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `corepack pnpm@10 exec tsc --noEmit`
Expected: no errors. (Confirm `Users` exists in the installed `lucide-react`; if not, swap for an existing icon already imported in `app/page.tsx`, e.g. `Trophy`.)

- [ ] **Step 3: Commit**

```bash
git add components/visitors-panel.tsx
git commit -m "feat(visits): add VisitorsPanel component"
```

---

### Task 6: Integrate into page + README

**Files:**
- Modify: `app/page.tsx` (import + render before `</main>` at ~line 498)
- Modify: `README.md` (setup section)

**Interfaces:**
- Consumes: `VisitorsPanel` from Task 5.
- Produces: visible panel on the home page.

- [ ] **Step 1: Import the component** near the other component imports in `app/page.tsx`:

```tsx
import { VisitorsPanel } from "@/components/visitors-panel"
```

- [ ] **Step 2: Render it** just before the closing `</main>` tag (~line 498):

```tsx
        <VisitorsPanel />
      </main>
```

- [ ] **Step 3: Add KV setup notes to `README.md`** (append a section):

```markdown
## Visit counter (Vercel KV)

The home page shows visit counts (today / week / month / year) backed by Vercel KV
(Upstash Redis). To enable in production:

1. Add the Upstash KV integration to the Vercel project.
2. `vercel env pull .env.local` to get `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
3. Deploy. Without these env vars the panel quietly shows `—`.

Counts are total page loads per UTC calendar period (no unique-visitor dedup).
```

- [ ] **Step 4: Verify build + tests**

Run: `corepack pnpm@10 build && corepack pnpm@10 test`
Expected: build succeeds, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx README.md
git commit -m "feat(visits): render visitors panel on home page + document KV setup"
```

---

## Self-Review

- **Spec coverage:** storage model (Tasks 1–2), `lib/visits.ts` API `periodKeys`/`getRedis`/`recordVisit` (Tasks 1–2), API route with `nodejs`/`force-dynamic` (Task 3), i18n (Task 4), client panel with loading/loaded/`—` states (Task 5), page integration + README setup (Task 6), unit tests for `periodKeys` ISO-week edges + `recordVisit` null-without-env (Tasks 1–2). All spec sections mapped.
- **Placeholder scan:** none — every code step shows full code.
- **Type consistency:** `VisitCounts` defined in Task 1, reused in Tasks 2–3; `periodKeys` shape (`{day,week,month,year,total}`) consistent; panel uses a widened `Counts` (numbers-or-null) matching the API's null payload. Env-var precedence identical in `getRedis` and README.

## Notes / risk

- `@upstash/redis` `pipeline().exec()` returns results in command order; we read `[day, week, month, year]` and ignore the 5th (`total`). Verified order matches the `incr` calls.
- No test framework existed before; Task 1 introduces Vitest. If the project later standardizes on a different runner, only `vitest.config.ts` + the two `.test.ts` files are affected.
