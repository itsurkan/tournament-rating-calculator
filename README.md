# tournament-rating-calculator

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_M9TZpUrKPIEi0uPsw5cZZxqPcKkb)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

## Visit counter

The home page shows visit counts (today / week / month / year). Counts are kept
in a free, no-signup hosted counter service ([abacus](https://abacus.jasoncameron.dev)):
each page load calls our `/api/visits` route, which increments one counter key per
calendar period (UTC) and returns the new values. **No database or env vars are
required** — it works out of the box on Vercel.

- Counts are total page loads per UTC calendar period (no unique-visitor dedup).
- If the counter service is unreachable, the panel quietly shows `—`.
- Optional: set `VISITS_NAMESPACE` to change the counter namespace (e.g. to keep
  preview/staging counts separate from production). Defaults to a built-in name.

Counts are total page loads per UTC calendar period (no unique-visitor dedup).

## Ligas cache and the `/admin` page

`/api/tournament` fetches tournament games fresh on every load, but caches each
player's rating history / profile (default 3 h) and the org ranking list
(default 6 h) in Next's data cache, so a live tournament recalculates instantly
without re-fetching ~40 player lookups from ligas each time.

`/admin` lets you change those TTLs and clear the cache **without a redeploy**.
It is off until you set:

- `ADMIN_TOKEN` — a long random secret; the page asks for it and sends it as a
  bearer token. Required for anything on `/admin`. "Clear cache" needs nothing else.

To make the TTLs editable (they are read-only otherwise):

1. In the Vercel dashboard, Storage → create an **Edge Config** store and connect
   it to this project. That sets `EDGE_CONFIG` automatically.
2. Add `EDGE_CONFIG_ID` (the store id, `ecfg_…`) and `VERCEL_API_TOKEN` (Account
   → Tokens; scope it to this project) — plus `VERCEL_TEAM_ID` if the project
   lives in a team.

Saved TTLs apply to lookups from then on; players cached earlier keep their old
expiry until they expire or you press "Clear ligas cache".
