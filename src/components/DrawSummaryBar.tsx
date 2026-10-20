"use client";

/**
 * DrawSummaryBar — mobile sticky bottom summary for the Draw Credit wizard.
 *
 * Visibility
 * ──────────
 * Shown on all breakpoints on the `amount` step once a credit line is
 * selected. `select`, `confirm`, and `status` steps are excluded
 * (see VISIBLE_STEPS).
 *
 * Scroll behaviour
 * ────────────────
 * Collapses to a one-line peek while the user scrolls down through the
 * amount step; expands again on scroll-up. Under reduced-motion the
 * transition is instant (see DrawSummaryBar.css).
 *
 * Accessibility
 * ─────────────
 * - `role="region"` landmark labelled "Draw summary".
 * - `tabIndex={0}` so keyboard users can Tab to the summary.
 * - Definition-list tiles in the expanded state; compact text in collapsed.
 * - Debounced `aria-live="polite"` region for screen-reader updates.
 */

import { CreditLine, DrawStep } from "@/types/draw-credit.types";
import { getDrawPricingQuote } from "@/lib/draw-credit-pricing";
import { formatMoney } from "@/utils/amountValidation";
import { useDebounceValue } from "@/hooks/useDebounceValue";
import { useScrollCollapse } from "@/hooks/useScrollCollapse";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import "./DrawSummaryBar.css";

interface DrawSummaryBarProps {
  creditLine: CreditLine | null;
  amount: number;
  step: DrawStep;
}

const VISIBLE_STEPS: ReadonlySet<DrawStep> = new Set<DrawStep>(["amount"]);

function buildAnnouncement(
  lineName: string,
  amountText: string,
  apr: number,
): string {
  return `Draw summary: ${lineName}, ${amountText} draw amount, ${apr} percent APR.`;
}

function computeSummary(
  line: CreditLine,
  amount: number,
): {
  apr: number;
  amountText: string;
  announcement: string;
} {
  const safeAmount = Math.max(amount, 0);
  const { apr } = getDrawPricingQuote(line, safeAmount);
  const amountText = formatMoney(safeAmount);
  const announcement = buildAnnouncement(line.name, amountText, apr);
  return { apr, amountText, announcement };
}

export function DrawSummaryBar({
  creditLine,
  amount,
  step,
}: DrawSummaryBarProps) {
  const isVisible = !!creditLine && VISIBLE_STEPS.has(step);
  const isCollapsed = useScrollCollapse(isVisible);
  const prefersReducedMotion = usePrefersReducedMotion();

  const summary =
    isVisible && creditLine ? computeSummary(creditLine, amount) : null;
  const announcement = summary ? summary.announcement : "";
  const debouncedAnnouncement = useDebounceValue(announcement, 400);

  if (!isVisible || !summary || !creditLine) {
    return null;
  }

  const { apr, amountText } = summary;

  return (
    <aside
      className={[
        "draw-summary-bar",
        isCollapsed ? "draw-summary-bar--collapsed" : "",
        prefersReducedMotion ? "draw-summary-bar--reduced-motion" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label="Draw summary"
      aria-expanded={!isCollapsed}
      tabIndex={0}
      data-step={step}
      data-testid="draw-summary-bar"
    >
      <div className="draw-summary-bar__inner">
        <p
          className="draw-summary-bar__peek"
          aria-hidden={!isCollapsed}
          data-testid="draw-summary-peek"
        >
          <span className="draw-summary-bar__peek-line">{creditLine.name}</span>
          <span className="draw-summary-bar__peek-sep" aria-hidden="true">
            ·
          </span>
          <span className="draw-summary-bar__peek-amount num-tabular">
            {amountText}
          </span>
          <span className="draw-summary-bar__peek-sep" aria-hidden="true">
            ·
          </span>
          <span className="draw-summary-bar__peek-apr num-tabular">{apr}% APR</span>
        </p>

        <dl className="draw-summary-bar__tiles">
          <div
            className="draw-summary-bar__tile"
            data-tile="line"
            data-testid="draw-summary-tile-line"
          >
            <dt className="draw-summary-bar__caption">Line</dt>
            <dd
              className="draw-summary-bar__value"
              data-testid="draw-summary-line"
            >
              {creditLine.name}
            </dd>
          </div>
          <div
            className="draw-summary-bar__tile"
            data-tile="amount"
            data-testid="draw-summary-tile-amount"
          >
            <dt className="draw-summary-bar__caption">Amount</dt>
            <dd
              className="draw-summary-bar__value num-tabular"
              data-testid="draw-summary-amount"
            >
              {amountText}
            </dd>
          </div>
          <div
            className="draw-summary-bar__tile"
            data-tile="apr"
            data-testid="draw-summary-tile-apr"
          >
            <dt className="draw-summary-bar__caption">APR</dt>
            <dd
              className="draw-summary-bar__value num-tabular"
              data-testid="draw-summary-apr"
            >
              {apr}%
            </dd>
          </div>
        </dl>
      </div>

      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="draw-summary-live"
      >
        {debouncedAnnouncement}
      </span>
    </aside>
  );
}

export default DrawSummaryBar;
