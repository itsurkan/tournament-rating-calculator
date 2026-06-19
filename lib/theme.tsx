"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

const STORAGE_KEY = "theme"

// Mirrors the blocking script in layout.tsx — keep both in sync.
function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.classList.toggle("light", resolved === "light")
  root.style.colorScheme = resolved
}

type ThemeContextValue = {
  /** The user's choice: light, dark, or follow-the-system. */
  mode: ThemeMode
  /** What that resolves to right now (system → light|dark). */
  resolved: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Server + first client render assume "system" so hydration matches; the stored
  // choice is read in an effect after mount (the blocking script already painted
  // the correct colors, so there is no flash — only the toggle's active state
  // updates here).
  const [mode, setModeState] = useState<ThemeMode>("system")
  const [resolved, setResolved] = useState<ResolvedTheme>("light")

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === "light" || raw === "dark" || raw === "system") setModeState(raw)
    } catch {
      // ignore unavailable storage
    }
  }, [])

  // Apply the theme whenever the mode changes, and — in "system" mode — keep it
  // in sync as the OS preference changes.
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const compute = () => {
      const next: ResolvedTheme =
        mode === "system" ? (mql.matches ? "dark" : "light") : mode
      setResolved(next)
      applyTheme(next)
    }
    compute()
    if (mode === "system") {
      mql.addEventListener("change", compute)
      return () => mql.removeEventListener("change", compute)
    }
  }, [mode])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore unavailable storage
    }
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
  return ctx
}
