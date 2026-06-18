# Filter Match Breakdown by Participant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user filter the Match breakdown table to a single participant via a dropdown, highlight that player in each row, and link every player name to their Ligas profile.

**Architecture:** Filter state and filtering live in `app/page.tsx` (where the tournament data already lives); `MatchesTable` stays presentational, gaining `highlightId` and `profileUrls` props. The dropdown is a native `<select>` styled like the existing `Input`. No new dependencies, no API changes, no rating-logic changes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, existing `lib/i18n.tsx` dictionary.

## Global Constraints

- Package manager: **`corepack pnpm@10`** (bare `pnpm`/pnpm 11 corrupts the lockfile — do not use it).
- No new npm dependencies.
- Every user-facing string goes through `useI18n().t(...)` with a key present in BOTH `en` and `uk` in `lib/i18n.tsx` (the `uk` dictionary is a typed `Record<TKey, string>`, so a missing key is a TypeScript error).
- This project has NO test framework. Per-task verification = `corepack pnpm@10 lint` + `corepack pnpm@10 build` (build does the TypeScript type-check). The final task adds manual preview verification.
- Filtering is dropdown-only. Names link to Ligas but are NOT click-to-filter.

---

### Task 1: Add i18n strings for the filter

**Files:**
- Modify: `lib/i18n.tsx` (the `en` object ~lines 18-58 and the `uk` object ~lines 62-103)

**Interfaces:**
- Consumes: nothing.
- Produces: three new `TKey`s usable via `t(...)`:
  - `"matches.filterLabel"`
  - `"matches.filterAll"`
  - `"matches.filterClear"`

- [ ] **Step 1: Add the three keys to the `en` dictionary**

In `lib/i18n.tsx`, inside the `const en = { ... } as const` object, add these lines after the existing `"matches.help": ...` entry:

```ts
  "matches.filterLabel": "Participant",
  "matches.filterAll": "All participants",
  "matches.filterClear": "Show all",
```

- [ ] **Step 2: Add the matching keys to the `uk` dictionary**

In the same file, inside `const uk: Record<TKey, string> = { ... }`, add after the existing `"matches.help": ...` entry:

```ts
  "matches.filterLabel": "Учасник",
  "matches.filterAll": "Усі учасники",
  "matches.filterClear": "Показати всі",
```

- [ ] **Step 3: Verify types and lint pass**

Run: `corepack pnpm@10 lint && corepack pnpm@10 build`
Expected: build succeeds. (If you added the key to `en` but not `uk`, the `Record<TKey, string>` annotation makes `uk` fail to type-check — that's the safety net.)

- [ ] **Step 4: Commit**

```bash
git add lib/i18n.tsx
git commit -m "feat: add i18n strings for match participant filter"
```

---

### Task 2: Make `MatchesTable` highlight a player and link names to Ligas

**Files:**
- Modify: `components/matches-table.tsx`

**Interfaces:**
- Consumes: `MatchContribution` (from `@/lib/rating`), `useI18n` (existing).
- Produces: updated `MatchesTable` prop signature, consumed by Task 3:

```ts
function MatchesTable(props: {
  matches: MatchContribution[]
  highlightId?: string
  profileUrls?: Record<string, string | null>
}): JSX.Element
```

  - `highlightId` (optional): when a name's player id equals it, that name renders with `font-semibold` + a subtle background accent.
  - `profileUrls` (optional, defaults `{}`): map of player id → Ligas profile URL (or null). When a URL is present the name is an `<a target="_blank">`; otherwise plain text.

- [ ] **Step 1: Add a `PlayerName` helper and update the component signature**

Replace the current component definition (the whole `export function MatchesTable({ matches }: { matches: MatchContribution[] }) { ... }` declaration and its body header) so the file reads as follows. Keep the existing imports at the top of the file; add nothing new to them.

Change the signature line from:

```tsx
export function MatchesTable({ matches }: { matches: MatchContribution[] }) {
  const { t } = useI18n()
```

to:

```tsx
function PlayerName({
  id,
  name,
  highlightId,
  profileUrls,
  className = "",
}: {
  id: string
  name: string
  highlightId?: string
  profileUrls: Record<string, string | null>
  className?: string
}) {
  const url = profileUrls[id]
  const highlighted = highlightId === id
  const base = `underline-offset-4 hover:text-primary hover:underline ${
    highlighted ? "rounded bg-primary/10 px-1 font-semibold text-foreground" : ""
  } ${className}`
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={base}>
        {name}
      </a>
    )
  }
  return <span className={base}>{name}</span>
}

export function MatchesTable({
  matches,
  highlightId,
  profileUrls = {},
}: {
  matches: MatchContribution[]
  highlightId?: string
  profileUrls?: Record<string, string | null>
}) {
  const { t } = useI18n()
```

- [ ] **Step 2: Render the winner name via `PlayerName`**

In the winner `<TableCell>`, replace:

```tsx
                  <span className="font-medium">{m.winnerName}</span>
```

with:

```tsx
                  <PlayerName
                    id={m.winnerId}
                    name={m.winnerName}
                    highlightId={highlightId}
                    profileUrls={profileUrls}
                    className="font-medium"
                  />
```

- [ ] **Step 3: Render the loser name via `PlayerName`**

In the loser `<TableCell>`, replace:

```tsx
                  <span className="text-muted-foreground">{m.loserName}</span>
```

with:

```tsx
                  <PlayerName
                    id={m.loserId}
                    name={m.loserName}
                    highlightId={highlightId}
                    profileUrls={profileUrls}
                    className="text-muted-foreground"
                  />
```

- [ ] **Step 4: Verify types and lint pass**

Run: `corepack pnpm@10 lint && corepack pnpm@10 build`
Expected: build succeeds with no type errors. `MatchesTable` is still called with only `matches` in `app/page.tsx` (the new props are optional), so the project still compiles.

- [ ] **Step 5: Commit**

```bash
git add components/matches-table.tsx
git commit -m "feat: link match-breakdown names to Ligas and support highlight"
```

---

### Task 3: Wire the participant dropdown and filtering into the page

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `MatchesTable` with `{ matches, highlightId, profileUrls }` (Task 2); the `matches.filter*` i18n keys (Task 1); existing `result.players`, `result.matches`, `data.players` (each with `id`, `name`, `profileUrl`).
- Produces: final user-facing feature. Nothing downstream depends on it.

- [ ] **Step 1: Add filter state**

In `app/page.tsx`, after the existing `const [factor, setFactor] = useState(1)` line, add:

```tsx
  const [filterPlayerId, setFilterPlayerId] = useState("")
```

- [ ] **Step 2: Reset the filter when a new tournament is calculated**

In `handleCalculate`, just after `setData(null)` (near the start of the `try`/state-reset block), add:

```tsx
      setFilterPlayerId("")
```

- [ ] **Step 3: Derive the filtered match list**

After the existing `result` `useMemo` block (the one ending `}, [data, startRatings, factor])`), add:

```tsx
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
```

- [ ] **Step 4: Add the dropdown + "Show all" control above the matches table**

In the `<TabsContent value="matches" ...>` block, replace:

```tsx
            <TabsContent value="matches" className="mt-4">
              <p className="mb-3 text-sm text-muted-foreground">
                {t("matches.help")}
              </p>
              <MatchesTable matches={result.matches} />
            </TabsContent>
```

with:

```tsx
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
                    aria-label={t("matches.filterLabel")}
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
```

- [ ] **Step 5: Verify types, lint, and build pass**

Run: `corepack pnpm@10 lint && corepack pnpm@10 build`
Expected: both succeed with no type errors.

- [ ] **Step 6: Manual preview verification**

Start the dev server (`preview_start`, or `corepack pnpm@10 dev`) and load the app. Then:
1. Paste the example URL `https://ligas.io/tournament/2el6ef/results` and Calculate.
2. Open the **Match breakdown** tab.
3. Select a participant in the dropdown → only matches where that player won or lost remain, and their name is highlighted (semibold + accent) in each row.
4. Click a player name → their Ligas profile opens in a new tab.
5. Click **"Show all"** → the full match list returns and the highlight clears.
6. Switch language (EN/UK) → the dropdown label, "All participants" option, and "Show all" button are translated.
7. Calculate a different tournament → the participant filter is reset to "All participants".

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: filter match breakdown by participant via dropdown"
```

---

## Self-Review

**Spec coverage:**
- Dropdown above matches table → Task 3 Step 4. ✓
- Default "all participants" / empty value → Task 1 (`matches.filterAll`), Task 3 Step 4 `<option value="">`. ✓
- Filter to winner-or-loser matches → Task 3 Step 3 `useMemo`. ✓
- Highlight selected player's name → Task 2 `PlayerName` + Task 3 passing `highlightId`. ✓
- "Show all" clear button → Task 1 (`matches.filterClear`), Task 3 Step 4. ✓
- Reset filter on recalculate → Task 3 Step 2. ✓
- Player names link to Ligas → Task 2 `PlayerName` + Task 3 `matchProfileUrls`. ✓
- Three i18n keys in en + uk → Task 1. ✓
- Native `<select>`, no new deps → Task 3 Step 4, Global Constraints. ✓
- Table stays presentational → Task 2 keeps all state in the page. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `MatchesTable` prop names (`matches`, `highlightId`, `profileUrls`) are identical in Task 2's definition and Task 3's usage. `filterPlayerId` and `setFilterPlayerId` consistent across Task 3. `matchProfileUrls` typed compatibly with `MatchesTable`'s `Record<string, string | null>`. ✓
