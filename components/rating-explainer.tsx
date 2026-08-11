"use client"

import type { MatchReason, RatingExplanation } from "@/lib/explain"
import { useI18n, type TKey } from "@/lib/i18n"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

const REASON_KEY: Record<MatchReason, TKey> = {
  beatClose: "explain.reason.beatClose",
  beatWeaker: "explain.reason.beatWeaker",
  beatFar: "explain.reason.beatFar",
  beatStronger: "explain.reason.beatStronger",
  beatUnrated: "explain.reason.beatUnrated",
  lostClose: "explain.reason.lostClose",
  lostStronger: "explain.reason.lostStronger",
  lostFar: "explain.reason.lostFar",
  lostWeaker: "explain.reason.lostWeaker",
  lostUnrated: "explain.reason.lostUnrated",
  unratedSelf: "explain.reason.unratedSelf",
}

function signed(n: number, digits = 0): string {
  const s = digits > 0 ? Math.abs(n).toFixed(digits) : String(Math.abs(n))
  return n < 0 ? `−${s}` : `+${s}`
}

// Small integer points pill, matching the matches-table style.
function Pill({ points }: { points: number }) {
  const positive = points >= 0
  return (
    <span
      className={`inline-flex rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold ${
        positive
          ? "border-positive/30 bg-positive/15 text-positive"
          : "border-negative/30 bg-negative/15 text-negative"
      }`}
    >
      {signed(points)}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-sm text-foreground">{children}</span>
    </div>
  )
}

/**
 * The math that turns match points into the rating delta — e.g.
 * "−1 × 10 / 7 = −1.43 ≈ −1.4". Rendered both inside the explainer dialog
 * and under a filtered player's match list. No outer box: callers frame it.
 */
export function RatingBreakdown({ exp }: { exp: RatingExplanation }) {
  const { t } = useI18n()
  const p = exp.player

  if (exp.zeroWeight) {
    return <p className="text-sm text-muted-foreground">{t("explain.zeroWeight")}</p>
  }

  // "[1.5 ×] −1 × 10 / 7 = −1.43"
  const factorPart = exp.factor !== 1 ? `${exp.factor} × ` : ""
  const formula = `${factorPart}${signed(exp.adjusted)} × 10 / ${exp.divisor} = ${signed(exp.deltaExact, 2)}`
  const capped = exp.divisor < exp.closingWeight

  return (
    <div className="flex flex-col gap-1.5">
      <Row label={t("explain.sum")}>{signed(exp.sum)}</Row>
      {exp.handicap > 0 && (
        <>
          <Row label={t("explain.handicap")}>−{exp.handicap}</Row>
          <Row label={t("explain.total")}>{signed(exp.adjusted)}</Row>
        </>
      )}
      <Row label={t("explain.weightRow")}>
        {exp.player.weightBefore} + {exp.contestWeight} = {exp.closingWeight}
        {capped && (
          <span className="text-muted-foreground"> ({t("explain.weightCapped")})</span>
        )}
      </Row>
      <Row label={t("explain.changeRow")}>
        {formula} <span className="font-semibold">≈ {signed(p.change, 1)}</span>
      </Row>
      <Row label={t("explain.ratingRow")}>
        {p.ratingBefore.toFixed(1)} {p.change < 0 ? "−" : "+"}{" "}
        {Math.abs(p.change).toFixed(1)} ={" "}
        <span className="font-semibold text-primary">{p.ratingAfter.toFixed(1)}</span>
      </Row>
      {exp.clampedToZero && (
        <p className="text-xs text-muted-foreground">{t("explain.clamped")}</p>
      )}
    </div>
  )
}

/**
 * "Why did this rating change?" — opened by clicking a Δ pill in the results
 * table. Lists every match with the rule that priced it, then the math.
 */
export function RatingExplainerDialog({
  exp,
  onClose,
}: {
  exp: RatingExplanation | null
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <Dialog
      open={exp !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      {exp && (
        <DialogContent>
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <DialogTitle>{exp.player.name}</DialogTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("explain.title")}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 font-mono">
              <span className="text-sm text-muted-foreground">
                {exp.player.ratingBefore.toFixed(1)}
                <span className="text-muted-foreground/50"> → </span>
                <span className="font-semibold text-primary">
                  {exp.player.ratingAfter.toFixed(1)}
                </span>
              </span>
              <span
                className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${
                  exp.player.change >= 0.05
                    ? "border-positive/30 bg-positive/15 text-positive"
                    : exp.player.change <= -0.05
                      ? "border-negative/30 bg-negative/15 text-negative"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {signed(exp.player.change, 1)}
              </span>
            </div>
          </div>

          {exp.player.provisional && (
            <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs leading-relaxed text-foreground">
              {t("explain.provisionalNote", {
                name: exp.player.name,
                base: exp.player.ratingBefore.toFixed(1),
              })}
            </p>
          )}

          <div className="mt-3 flex flex-col divide-y divide-border rounded-lg border border-border">
            {exp.matches.map((m, i) => (
              <div key={`${m.oppId}-${i}`} className="flex items-center gap-2.5 px-3 py-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                    m.won
                      ? "border-positive/30 bg-positive/15 text-positive"
                      : "border-negative/30 bg-negative/15 text-negative"
                  }`}
                  title={m.won ? t("matches.won") : t("matches.lost")}
                >
                  {m.won ? t("matches.resultWin") : t("matches.resultLoss")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {m.oppName}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {m.oppRating.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[11px] leading-tight text-muted-foreground">
                    {t(REASON_KEY[m.reason])}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                  {m.score}
                </span>
                <Pill points={m.points} />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
            <RatingBreakdown exp={exp} />
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
