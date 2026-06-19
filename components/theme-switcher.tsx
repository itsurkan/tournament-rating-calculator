"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme, type ThemeMode } from "@/lib/theme"
import { useI18n, type TKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const OPTIONS: { value: ThemeMode; Icon: typeof Sun; labelKey: TKey }[] = [
  { value: "light", Icon: Sun, labelKey: "theme.light" },
  { value: "dark", Icon: Moon, labelKey: "theme.dark" },
  { value: "system", Icon: Monitor, labelKey: "theme.system" },
]

export function ThemeSwitcher() {
  const { mode, setMode } = useTheme()
  const { t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5"
    >
      {OPTIONS.map(({ value, Icon, labelKey }) => {
        const active = mode === value
        const label = t(labelKey)
        return (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={active}
            aria-label={label}
            title={label}
            className={cn(
              "rounded-full p-1.5 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}
