# Ukrainian language support (UK default + EN switcher)

**Date:** 2026-06-17
**Status:** Approved design

## Goal

Add Ukrainian and English translations to the Ligas Rating Calculator, with a
header language switcher. Ukrainian is the default on first visit; the choice
persists across visits.

## Approach

Lightweight dictionary + React Context. No i18n library, no route
restructuring. The app is a single client-rendered page, so the machinery of
`next-intl` (locale-in-URL, middleware, SSR) buys SEO/URL benefits this personal
tool does not need.

## Components

### 1. i18n core — `lib/i18n.tsx`

- Typed dictionary keyed by string id, e.g. `header.title`, `form.calculate`,
  `results.weight`. Shape: `{ uk: Record<Key, string>, en: Record<Key, string> }`.
  UK is listed first as the default.
- `Locale = "uk" | "en"`. `DEFAULT_LOCALE = "uk"`.
- `LanguageProvider` (client component):
  - holds `locale` state; initial value read from `localStorage["locale"]`,
    falling back to `DEFAULT_LOCALE`;
  - persists `locale` to `localStorage` on change;
  - syncs `document.documentElement.lang` to the active locale via effect.
- `useI18n()` hook → `{ locale, setLocale, t }`.
- `t(key, vars?)`: dictionary lookup against the active locale with simple
  `{name}` / `{n}`-style interpolation. Falls back to the key string if missing.

### 2. Language switcher — `components/language-switcher.tsx`

- Small segmented UK / EN control, rendered top-right in the page header.
- Calls `setLocale`; highlights the active locale.

### 3. Wiring

- `app/layout.tsx`:
  - `<html lang="uk">` static default.
  - wrap `{children}` in `LanguageProvider`.
  - metadata title/description → Ukrainian (static/server-rendered; matches the
    default locale).
- `app/page.tsx`, `components/results-table.tsx`,
  `components/matches-table.tsx`: replace every hardcoded user-facing string
  with `t(...)`. Includes `aria-label`s, the provisional badge, table headers,
  the processed/unprocessed explainer paragraphs, and the footer label.
- The example URL constant stays untranslated (it is data, not copy).

### 4. API error strings

`app/api/tournament/route.ts` currently returns English error messages. Change
it to return a stable `code` instead, translated client-side:

| code | meaning |
|---|---|
| `no_tournament_id` | URL contained no parseable tournament id (400) |
| `fetch_failed` | upstream ligas.io request failed (502) |

`app/page.tsx` maps `json.code` → `t(\`error.\${code}\`)`, with a generic
`error.unknown` fallback (replacing the current "Something went wrong.").

## String inventory & Ukrainian translations

Final wording is tunable during implementation; this is the baseline.

| key | en | uk |
|---|---|---|
| `header.eyebrow` | Table tennis rating calculator | Калькулятор рейтингу з настільного тенісу |
| `header.title` | Ligas Rating Calculator | Калькулятор рейтингу Ligas |
| `header.intro` | Paste a ligas.io tournament URL to instantly calculate… (full paragraph) | Вставте посилання на турнір з ligas.io, щоб миттєво розрахувати зміну рейтингу кожного гравця за офіційною формулою ФНТУ… |
| `form.urlLabel` | Ligas tournament URL | Посилання на турнір Ligas |
| `form.calculate` | Calculate | Розрахувати |
| `form.calculating` | Calculating | Розраховуємо |
| `form.tryExample` | Try the example: | Спробуйте приклад: |
| `tournament.players` | {n} players | Гравців: {n} |
| `tournament.matches` | {n} matches | Матчів: {n} |
| `tournament.processed` | Already processed by ligas — … | Турнір уже оброблено ligas — початкові рейтинги є дотурнірними значеннями… |
| `tournament.unprocessed` | Not yet processed by ligas — … | Турнір ще не оброблено ligas — початкові рейтинги є поточними рейтингами… |
| `tabs.players` | Player ratings | Рейтинги гравців |
| `tabs.matches` | Match breakdown ({n}) | Розбір матчів ({n}) |
| `players.help` | Edit any starting rating to recalculate instantly… | Змініть будь-який початковий рейтинг, щоб миттєво перерахувати… |
| `players.factor` | Tournament factor | Коефіцієнт турніру |
| `matches.help` | Each match shows the integer points… | Кожен матч показує цілі очки, які заробили обидва гравці… |
| `footer.createdBy` | Created by Ivan Tsurkan | Створив Іван Цуркан |
| `results.col.player` | Player | Гравець |
| `results.col.wl` | W / L | W / L |
| `results.col.weight` | Weight | Вага |
| `results.col.startRating` | Start rating | Початковий рейтинг |
| `results.col.after` | After | Після |
| `results.col.change` | Change | Зміна |
| `results.provisional` | provisional | новачок |
| `results.startRatingFor` | Starting rating for {name} | Початковий рейтинг для {name} |
| `matches.col.winner` | Winner | Переможець |
| `matches.col.score` | Score | Рахунок |
| `matches.col.loser` | Loser | Переможений |
| `matches.col.stage` | Stage | Етап |
| `matches.col.points` | Points | Очки |
| `error.no_tournament_id` | Could not find a tournament id in that URL. | Не вдалося знайти ідентифікатор турніру в цьому посиланні. |
| `error.fetch_failed` | Failed to load this tournament from ligas.io. | Не вдалося завантажити цей турнір з ligas.io. |
| `error.unknown` | Something went wrong. | Щось пішло не так. |
| `meta.title` | Ligas Rating Calculator | Калькулятор рейтингу Ligas |
| `meta.description` | Paste a ligas.io tournament URL and instantly calculate… | Вставте посилання на турнір з ligas.io та миттєво розрахуйте зміну рейтингу… |

Ukrainian plural agreement is sidestepped by using label-form counts
("Гравців: {n}") rather than inline "{n} players".

## Testing / verification

- Type-check / build passes (`corepack pnpm@10 build` per project memory).
- Manual: default load shows Ukrainian + `<html lang="uk">`; switching to EN
  updates all visible strings and `lang`; reload preserves the chosen locale;
  an invalid URL surfaces the translated error.

## Trade-offs

- Client-side toggle means SSR'd `<html lang>` and static metadata are fixed to
  the default (uk). Switching to EN updates `lang` client-side but not the
  static metadata. Acceptable for a personal tool; per-locale URLs/SEO would
  require approach B (`next-intl` + `[locale]` routes).
