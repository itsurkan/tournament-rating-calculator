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
  "tournament.players": "{n} players",
  "tournament.matches": "{n} matches",
  "tournament.processed":
    "Already processed by ligas — starting ratings are each player’s pre-tournament values, so “After” should match ligas’ official result.",
  "tournament.unprocessed":
    "Not yet processed by ligas — starting ratings are each player’s current rating, i.e. a live prediction of the outcome.",
  "tabs.players": "Player ratings",
  "tabs.matches": "Match breakdown ({n})",
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
  "results.col.player": "Player",
  "results.col.wl": "W / L",
  "results.col.weight": "Weight",
  "results.col.startRating": "Start rating",
  "results.col.after": "After",
  "results.col.change": "Change",
  "results.provisional": "provisional",
  "results.startRatingFor": "Starting rating for {name}",
  "matches.col.winner": "Winner",
  "matches.col.score": "Score",
  "matches.col.loser": "Loser",
  "matches.col.stage": "Stage",
  "matches.col.points": "Points",
  "error.no_tournament_id": "Could not find a tournament id in that URL.",
  "error.fetch_failed": "Failed to load this tournament from ligas.io.",
  "error.unknown": "Something went wrong.",
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
  "tournament.players": "Гравців: {n}",
  "tournament.matches": "Матчів: {n}",
  "tournament.processed":
    "Турнір уже оброблено ligas — початкові рейтинги є дотурнірними значеннями кожного гравця, тож «Після» має збігатися з офіційним результатом ligas.",
  "tournament.unprocessed":
    "Турнір ще не оброблено ligas — початкові рейтинги є поточними рейтингами кожного гравця, тобто живим прогнозом результату.",
  "tabs.players": "Рейтинги гравців",
  "tabs.matches": "Розбір матчів ({n})",
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
  "results.col.player": "Гравець",
  "results.col.wl": "W / L",
  "results.col.weight": "Вага",
  "results.col.startRating": "Початковий рейтинг",
  "results.col.after": "Після",
  "results.col.change": "Зміна",
  "results.provisional": "новачок",
  "results.startRatingFor": "Початковий рейтинг для {name}",
  "matches.col.winner": "Переможець",
  "matches.col.score": "Рахунок",
  "matches.col.loser": "Переможений",
  "matches.col.stage": "Етап",
  "matches.col.points": "Очки",
  "error.no_tournament_id":
    "Не вдалося знайти ідентифікатор турніру в цьому посиланні.",
  "error.fetch_failed": "Не вдалося завантажити цей турнір з ligas.io.",
  "error.unknown": "Щось пішло не так.",
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
