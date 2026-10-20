import { CreditLine } from "@/types/draw-credit.types";
import { formatMoney } from "@/utils/amountValidation";
import { lineAccentColor } from "../utils/tokens";

interface CreditLineSummaryBlockProps {
  /** Credit line being summarised. */
  creditLine: CreditLine;
  /**
   * Optional pending draw amount. When supplied, the summary highlights
   * the projected utilised/available balances *after* the draw so the
   * user can compare before-vs-after at a glance. Defaults to 0.
   */
  amount?: number;
}

/**
 * Compact, reusable summary card for a single credit line.
 *
 * Used inside the draw wizard's confirmation step and in the credit-line
 * dashboard tiles. Surfaces three numbers — limit, utilised, available —
 * plus the projected post-draw values when `amount > 0`. All values are
 * formatted through `formatMoney` so locale and currency are consistent
 * with the rest of the app.
 *
 * Accessibility notes:
 * - The 3 px left accent stripe is purely decorative; `aria-hidden="true"`
 *   keeps it out of the accessibility tree.
 * - The stripe color is paired visually with the credit line's short name
 *   in the header so the card remains identifiable in monochrome or when
 *   CSS colors are overridden (e.g. forced-colors / Windows High Contrast).
 * - `position: relative` on the wrapper and `position: absolute` on the
 *   stripe avoid any layout shift — the stripe occupies zero inline width
 *   from the card's perspective.
 *
 * Purely presentational. No side effects, no state.
 */
export function CreditLineSummaryBlock({
  creditLine,
  amount = 0,
}: CreditLineSummaryBlockProps) {
  const utilized = creditLine.limit - creditLine.available;
  const safeAmount = Math.max(amount, 0);
  const projectedUtilized = utilized + safeAmount;
  const projectedAvailable = Math.max(creditLine.available - safeAmount, 0);

  // Deterministic accent color derived from the line's stable id.
  const accentColor = lineAccentColor(creditLine.id);

  return (
    <section
      className="bg-surface rounded-xl border border-border p-5 space-y-4"
      style={{
        position: "relative",
        // Clip the absolute stripe to the card's rounded corners.
        overflow: "hidden",
      }}
    >
      {/*
       * Accent stripe — 3 px wide, full card height, pinned to the left edge.
       *
       * aria-hidden: the stripe is decorative; meaning is carried by the
       * credit line name in the header below (WCAG 1.4.1 Use of Color).
       *
       * The `borderRadius` on the right side softens the top-left /
       * bottom-left pill so it doesn't fight the card's own border-radius.
       */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 3,
          height: "100%",
          background: accentColor,
          borderRadius: "4px 0 0 4px",
          pointerEvents: "none",
        }}
      />

      <header>
        {/*
         * The heading visually pairs the stripe color with the line name.
         * A short colored swatch dot (aria-hidden) echoes the stripe so
         * the association survives when the card is viewed without spatial
         * context (e.g. a screen reader virtual cursor, or a monochrome
         * print). The dot is intentionally redundant with the stripe —
         * the text label is the accessible name.
         */}
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          {/* Inline color swatch — decorative, mirrors the stripe */}
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: accentColor,
              flexShrink: 0,
            }}
          />
          Credit Summary
        </h3>
        {/* The line name is the primary text label — not the color */}
        <p className="text-xs text-muted mt-1">{creditLine.name}</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Limit</p>
          <p className="text-base font-semibold text-foreground mt-1 tabular-nums">
            {formatMoney(creditLine.limit)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Utilized</p>
          <p className="text-base font-semibold text-foreground mt-1 tabular-nums">
            {formatMoney(projectedUtilized)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-muted">Available</p>
          <p className="text-base font-semibold text-foreground mt-1 tabular-nums">
            {formatMoney(projectedAvailable)}
          </p>
        </div>
      </div>
    </section>
  );
}
