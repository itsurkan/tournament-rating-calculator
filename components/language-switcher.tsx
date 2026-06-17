"use client"

import { useI18n, type Locale } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const LOCALES: { value: Locale; label: string }[] = [
  { value: "uk", label: "UA" },
  { value: "en", label: "EN" },
]

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {LOCALES.map(({ value, label }) => {
        const active = locale === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
