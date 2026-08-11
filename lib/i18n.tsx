"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type Locale = "uk" | "en"

export const DEFAULT_LOCALE: Locale = "uk"
const STORAGE_KEY = "locale"

// English is the source dictionary; its keys define the full set of strings and
// `uk` must cover all of them (enforced by the typed `Record` below).
const en = {
  "header.eyebrow": "Table tennis rating calculator",
  "header.title": "Ligas Rating Calculator",
  "header.intro":
    "Paste a ligas.io tournament URL to instantly calculate each player’s rating change using the official FNTU formula — no waiting for ligas to process the event. Starting ratings and weights are pulled live from each player’s profile and remain fully editable.",
  "form.urlLabel": "Ligas tournament URL",
  "form.calculate": "Calculate",
  "form.calculating": "Calculating",
  "form.tryExample": "Try the example:",
  "form.clear": "Clear",
  "form.paste": "Paste from clipboard",
  "tournament.players": "{n} players",
  "tournament.matches": "{n} matches",
  "tournament.processed":
    "Already processed by ligas — starting ratings are each player’s pre-tournament values, so “After” should match ligas’ official result.",
  "tournament.unprocessed":
    "Not yet processed by ligas — starting ratings are each player’s current rating, i.e. a live prediction of the outcome.",
  "tabs.players": "Standings",
  "tabs.matches": "Matches ({n})",
  "players.help":
    "Edit any starting rating to recalculate instantly. Provisional players start unrated (0) and are anchored to a base rating from their results.",
  "players.factor": "Tournament factor",
  "players.factorAria": "Tournament factor (coefficient)",
  "matches.help":
    "Each match shows the integer points both players earned, based on their pre-tournament ratings. Points are summed per player, then scaled by weight and the tournament factor.",
  "matches.filterLabel": "Participant",
  "matches.filterAll": "All participants",
  "matches.filterClear": "Show all",
  "footer.createdBy": "Created by Ivan Tsurkan",
  "recent.title": "Recent tournaments",
  "recent.empty": "Tournaments you view show up here.",
  "recent.clear": "Clear",
  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "System",
  "results.col.player": "Player",
  "results.col.wl": "W / L",
  "results.col.weight": "Weight",
  "results.col.startRating": "Start rating",
  "results.col.after": "After",
  "results.col.rating": "Rating",
  "results.col.change": "Change",
  "results.edit": "Edit",
  "results.editDone": "Done",
  "results.reset": "Reset",
  "results.provisional": "provisional",
  "results.startRatingFor": "Starting rating for {name}",
  "matches.col.winner": "Winner",
  "matches.col.score": "Score",
  "matches.col.loser": "Loser",
  "matches.col.stage": "Stage",
  "matches.col.points": "Points",
  "matches.col.opponent": "Opponent",
  "matches.resultWin": "W",
  "matches.resultLoss": "L",
  "matches.won": "Won",
  "matches.lost": "Lost",
  "matches.total": "Tournament total",
  "matches.roundCount": "{n} matches",
  "matches.showMore": "Show {n} more matches",
  "matches.showLess": "Collapse",
  "matches.totalPoints": "{name}: total",
  "matches.record": "{n} matches · {w} wins – {l} losses",
  "error.no_tournament_id": "Could not find a tournament id in that URL.",
  "error.fetch_failed": "Failed to load this tournament from ligas.io.",
  "error.unknown": "Something went wrong.",
  "visits.heading": "Visits",
  "visits.today": "Today",
  "visits.week": "This week",
  "visits.month": "This month",
  "visits.year": "This year",
  // Short forms — the four counters sit in one row on narrow phones.
  "visits.todayShort": "Today",
  "visits.weekShort": "Week",
  "visits.monthShort": "Month",
  "visits.yearShort": "Year",
  "footer.feedback": "Send feedback",
  "explain.title": "Why did the rating change?",
  "explain.aria": "Explain the rating change for {name}",
  "explain.reason.beatClose": "Win over an equal (gap ≤ 2)",
  "explain.reason.beatWeaker": "Win over a lower-rated player (gap ≤ 20)",
  "explain.reason.beatFar": "Win over a much lower-rated player (gap > 20) — no points",
  "explain.reason.beatStronger": "Win over a higher-rated player: round((gap + 5) / 3)",
  "explain.reason.beatUnrated": "Opponent has no rating — no points",
  "explain.reason.lostClose": "Loss to an equal (gap ≤ 2)",
  "explain.reason.lostStronger": "Loss to a higher-rated player (gap ≤ 20)",
  "explain.reason.lostFar": "Loss to a much higher-rated player (gap > 20) — no points",
  "explain.reason.lostWeaker": "Loss to a lower-rated player: −round((gap + 5) / 3)",
  "explain.reason.lostUnrated": "Opponent has no rating — no points",
  "explain.reason.unratedSelf": "Unrated players lose no points",
  "explain.provisionalNote":
    "{name} entered with no rating weight, so they count as a newcomer: the starting {base} is a base rating derived from this tournament (the lower of the weakest rated player they lost to and the strongest they beat), and a fixed 2-game handicap is charged on top of their match points.",
  "explain.sum": "Match points",
  "explain.handicap": "Newcomer handicap",
  "explain.total": "Into the formula",
  "explain.weightRow": "Weight: before + |points|",
  "explain.weightCapped": "max 40 in the formula",
  "explain.changeRow": "Change",
  "explain.ratingRow": "New rating",
  "explain.zeroWeight": "No rated games — the rating stays at 0.",
  "explain.clamped": "Ratings never drop below 0 — the result is clamped.",
} as const

export type TKey = keyof typeof en

const uk: Record<TKey, string> = {
  "header.eyebrow": "Калькулятор рейтингу з настільного тенісу",
  "header.title": "Калькулятор рейтингу Ligas",
  "header.intro":
    "Вставте посилання на турнір з ligas.io, щоб миттєво розрахувати зміну рейтингу кожного гравця за офіційною формулою ФНТУ — без очікування, поки ligas обробить турнір. Початкові рейтинги та ваги підтягуються наживо з профілю кожного гравця й залишаються повністю редагованими.",
  "form.urlLabel": "Посилання на турнір Ligas",
  "form.calculate": "Розрахувати",
  "form.calculating": "Розраховуємо",
  "form.tryExample": "Спробуйте приклад:",
  "form.clear": "Очистити",
  "form.paste": "Вставити з буфера",
  "tournament.players": "Гравців: {n}",
  "tournament.matches": "Матчів: {n}",
  "tournament.processed":
    "Турнір уже оброблено ligas — початкові рейтинги є дотурнірними значеннями кожного гравця, тож «Після» має збігатися з офіційним результатом ligas.",
  "tournament.unprocessed":
    "Турнір ще не оброблено ligas — початкові рейтинги є поточними рейтингами кожного гравця, тобто живим прогнозом результату.",
  "tabs.players": "Таблиця",
  "tabs.matches": "Матчі ({n})",
  "players.help":
    "Змініть будь-який початковий рейтинг, щоб миттєво перерахувати. Гравці-новачки починають без рейтингу (0) і прив’язуються до базового рейтингу за їхніми результатами.",
  "players.factor": "Коефіцієнт турніру",
  "players.factorAria": "Коефіцієнт турніру",
  "matches.help":
    "Кожен матч показує цілі очки, які заробили обидва гравці, на основі їхніх дотурнірних рейтингів. Очки сумуються по кожному гравцю, а потім масштабуються за вагою та коефіцієнтом турніру.",
  "matches.filterLabel": "Учасник",
  "matches.filterAll": "Усі учасники",
  "matches.filterClear": "Показати всі",
  "footer.createdBy": "Створив Іван Цуркан",
  "recent.title": "Нещодавні турніри",
  "recent.empty": "Тут з’являться переглянуті турніри.",
  "recent.clear": "Очистити",
  "theme.label": "Тема",
  "theme.light": "Світла",
  "theme.dark": "Темна",
  "theme.system": "Системна",
  "results.col.player": "Гравець",
  "results.col.wl": "W / L",
  "results.col.weight": "Вага",
  "results.col.startRating": "Початковий рейтинг",
  "results.col.after": "Після",
  "results.col.rating": "Рейтинг",
  "results.col.change": "Зміна",
  "results.edit": "Редагувати",
  "results.editDone": "Готово",
  "results.reset": "Скинути",
  "results.provisional": "новачок",
  "results.startRatingFor": "Початковий рейтинг для {name}",
  "matches.col.winner": "Переможець",
  "matches.col.score": "Рахунок",
  "matches.col.loser": "Переможений",
  "matches.col.stage": "Етап",
  "matches.col.points": "Очки",
  "matches.col.opponent": "Суперник",
  "matches.resultWin": "В",
  "matches.resultLoss": "П",
  "matches.won": "Перемога",
  "matches.lost": "Поразка",
  "matches.total": "Разом за турнір",
  "matches.roundCount": "{n} матчів",
  "matches.showMore": "Показати ще {n} матчів",
  "matches.showLess": "Згорнути",
  "matches.totalPoints": "{name}: разом",
  "matches.record": "{n} матчів · {w} перемоги – {l} поразки",
  "error.no_tournament_id":
    "Не вдалося знайти ідентифікатор турніру в цьому посиланні.",
  "error.fetch_failed": "Не вдалося завантажити цей турнір з ligas.io.",
  "error.unknown": "Щось пішло не так.",
  "visits.heading": "Відвідування",
  "visits.today": "Сьогодні",
  "visits.week": "Цей тиждень",
  "visits.month": "Цей місяць",
  "visits.year": "Цей рік",
  "visits.todayShort": "Сьогодні",
  "visits.weekShort": "Тиждень",
  "visits.monthShort": "Місяць",
  "visits.yearShort": "Рік",
  "footer.feedback": "Надіслати фідбек",
  "explain.title": "Чому змінився рейтинг?",
  "explain.aria": "Пояснити зміну рейтингу для {name}",
  "explain.reason.beatClose": "Перемога над рівним (розрив ≤ 2)",
  "explain.reason.beatWeaker": "Перемога над слабшим (розрив ≤ 20)",
  "explain.reason.beatFar": "Перемога над значно слабшим (розрив > 20) — 0 очок",
  "explain.reason.beatStronger": "Перемога над сильнішим: округл((розрив + 5) / 3)",
  "explain.reason.beatUnrated": "Суперник без рейтингу — 0 очок",
  "explain.reason.lostClose": "Поразка від рівного (розрив ≤ 2)",
  "explain.reason.lostStronger": "Поразка від сильнішого (розрив ≤ 20)",
  "explain.reason.lostFar": "Поразка від значно сильнішого (розрив > 20) — 0 очок",
  "explain.reason.lostWeaker": "Поразка від слабшого: −округл((розрив + 5) / 3)",
  "explain.reason.lostUnrated": "Суперник без рейтингу — 0 очок",
  "explain.reason.unratedSelf": "Гравець без рейтингу не втрачає очок",
  "explain.provisionalNote":
    "{name} заходить у турнір без ваги рейтингу, тож рахується як новачок: стартові {base} — це «опорний» рейтинг, виведений із цього турніру (менше з двох: найслабший рейтинговий суперник серед поразок і найсильніший серед перемог), а з очок за матчі знімається фіксований гандикап у 2 гри.",
  "explain.sum": "Очки за матчі",
  "explain.handicap": "Гандикап новачка",
  "explain.total": "У формулу",
  "explain.weightRow": "Вага: до + |очки|",
  "explain.weightCapped": "у формулі макс. 40",
  "explain.changeRow": "Зміна",
  "explain.ratingRow": "Новий рейтинг",
  "explain.zeroWeight": "Немає рейтингових ігор — рейтинг лишається 0.",
  "explain.clamped": "Рейтинг не опускається нижче 0 — результат обрізано.",
}

const dict: Record<Locale, Record<TKey, string>> = { uk, en }

type Vars = Record<string, string | number>

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TKey, vars?: Vars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Both server and first client render use DEFAULT_LOCALE so hydration matches;
  // the persisted choice is applied in an effect after mount.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "uk" || stored === "en") setLocaleState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  function setLocale(next: Locale) {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore storage failures (private mode, etc.)
    }
  }

  function t(key: TKey, vars?: Vars) {
    return interpolate(dict[locale][key] ?? key, vars)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within a LanguageProvider")
  return ctx
}
