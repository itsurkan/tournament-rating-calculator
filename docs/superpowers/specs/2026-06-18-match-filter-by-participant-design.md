# Filter Match Breakdown by Participant — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)

## Goal

On the **Match breakdown** tab, let the user filter the matches table down to a
single participant — showing only the matches that participant won or lost.

## User Experience

- A **participant dropdown** sits above the matches table, in the `Matches` tab,
  alongside the existing `matches.help` text.
- The dropdown lists every player by name. Its default option is an "all
  participants" state (empty value) that shows the full match list.
- Selecting a participant filters the table to matches where that player is the
  winner or the loser.
- When a participant is selected:
  - The selected player's name is **highlighted** in each matching row (the
    winner or loser cell carrying that player gets a subtle accent —
    `font-semibold` + muted background) so their side is obvious at a glance.
  - A plain **"Show all"** text button appears next to the dropdown to clear the
    filter. Selecting the "all participants" option also clears it.
- **Player names link to Ligas.** Each winner/loser name in the table is a link
  to that player's Ligas profile, opening in a new tab — mirroring the existing
  behaviour in the Players table (`results-table.tsx`). Names without a profile
  URL render as plain text. The Ligas link and the filter highlight compose: a
  highlighted name is still a working link.
- The tab counter (`tabs.matches`) and `matches.help` text are unchanged.

## Decisions

- **Dropdown only.** Names in the table are NOT clickable. The dropdown is the
  single filter entry point. (Considered and rejected: click-a-name-to-filter,
  free-text search.)
- **Native `<select>`** styled to match the existing `Input` component. No Radix
  Select / combobox dependency is added — that would be heavier than this needs,
  and there is no existing combobox primitive.

## Architecture

- **State** lives in `app/page.tsx`: a single `filterPlayerId: string` (empty =
  show all).
- The state is **reset to empty whenever a new tournament is calculated**
  (`handleCalculate`), so a stale selection from a previous tournament does not
  linger.
- Filtering happens in `app/page.tsx` via a `useMemo` over `result.matches`:
  keep rows where `winnerId === filterPlayerId || loserId === filterPlayerId`.
  When `filterPlayerId` is empty, the full list passes through.
- The filtered list and the active `filterPlayerId` are passed to
  `MatchesTable`, along with a `profileUrls` map (the same map already built in
  `app/page.tsx` for the Players table). The table component stays
  presentational — it renders whatever matches it is given, highlights the cell
  matching `filterPlayerId`, and links each name via `profileUrls`.
- The dropdown options come from `result.players` (already sorted by rating).

## Components Touched

- `app/page.tsx` — new state, reset on calculate, `useMemo` filter, dropdown
  control, "Show all" button, pass `filterPlayerId` + filtered matches down.
- `components/matches-table.tsx` — accept optional `highlightId` and
  `profileUrls` props; apply the highlight accent to the winner/loser cell whose
  id matches, and render each name as a Ligas profile link (plain text when no
  URL), reusing the link styling from `results-table.tsx`.
- `lib/i18n.tsx` — three new keys in both `en` and `uk`:
  - `matches.filterLabel` — "Participant" / "Учасник"
  - `matches.filterAll` — "All participants" / "Усі учасники"
  - `matches.filterClear` — "Show all" / "Показати всі"

## Out of Scope

- No new dependencies.
- No API changes.
- No changes to the rating calculation.
- No multi-select, no free-text search.
- Names link to Ligas but are NOT click-to-filter — filtering is dropdown-only.

## Testing / Verification

- Manual verification in the dev preview: load the example tournament, select a
  participant, confirm only their matches show and their name is highlighted;
  confirm clicking a player name opens their Ligas profile in a new tab; click
  "Show all" to confirm reset; switch language and confirm the new strings are
  translated; recalculate a new tournament and confirm the filter resets.
