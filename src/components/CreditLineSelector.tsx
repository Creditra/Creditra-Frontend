/**
 * CreditLineSelector
 *
 * Step 1 of the draw-credit flow. Renders the user's credit lines, with
 * drawable lines listed first and ineligible lines still discoverable but
 * clearly disabled.
 *
 * Design-token classes used (all from `src/index.css` `.dc-*` block):
 *   dc-credit-line-list, dc-credit-line-item, dc-credit-line-item__name,
 *   dc-credit-line-item__meta, dc-credit-line-item__label,
 *   dc-credit-line-item__value, dc-credit-line-item__value--warning,
 *   dc-credit-line-item__warning-badge, dc-credit-line-item__reason,
 *   dc-credit-line-item__reason-link, dc-progress-track, dc-progress-bar,
 *   dc-progress-bar--warning, dc-chevron
 *
 * Accessibility:
 *   - Each button has an aria-label describing the credit line and available balance.
 *   - Ineligible lines use `aria-disabled="true"` (not native `disabled`) so
 *     they remain focusable/discoverable, and are described by their reason.
 *   - The reason doubles as a link to the action that can unblock the line.
 *   - Utilization progress bar is a <div role="progressbar"> with aria-valuenow/min/max.
 *   - High-utilization badge has role="status" so it is announced by screen readers.
 */

import { Link } from "react-router-dom";
import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, ChevronRight } from "lucide-react";
import {
  getDrawEligibility,
  type DrawIneligibilityReason,
} from "@/lib/draw-eligibility";

interface CreditLineSelectorProps {
  /** Credit lines the user can choose from (eligible or not). */
  creditLines: CreditLine[];
  /**
   * Invoked when the user picks an eligible line. The wizard advances to
   * the amount step on the next render — there is no internal selection
   * state in this component.
   */
  onSelect: (creditLine: CreditLine) => void;
  /**
   * Optional id of the header micro-indicator (`draw-wizard-micro-select`)
   * so the step heading is described by the wizard validity chip.
   */
  microProgressDescribedBy?: string;
}

interface IneligibleCopy {
  /** Visible reason, also used as the action link's label. */
  message: string;
  href: (id: string) => string;
}

const INELIGIBLE_COPY: Record<DrawIneligibilityReason, IneligibleCopy> = {
  suspended: {
    message: "Suspended — review on Credit Lines",
    href: (id) => `/credit-lines?highlight=${encodeURIComponent(id)}`,
  },
  defaulted: {
    message: "Defaulted — review on Credit Lines",
    href: (id) => `/credit-lines?highlight=${encodeURIComponent(id)}`,
  },
  frozen: {
    message: "Frozen — unfreeze on Credit Lines",
    href: (id) => `/credit-lines?highlight=${encodeURIComponent(id)}`,
  },
  closed: {
    message: "Closed — view on Credit Lines",
    href: (id) => `/credit-lines?highlight=${encodeURIComponent(id)}`,
  },
  no_available: {
    message: "No available credit — repay on Repay",
    href: (id) => `/repay?line=${encodeURIComponent(id)}`,
  },
};

/**
 * Step 1 of the draw-credit wizard.
 *
 * Renders the user's credit lines as a list of large click targets. Each
 * row shows the line name, available balance, current utilization, and a
 * "select" affordance. Picking an eligible row calls `onSelect(creditLine)`
 * so the parent wizard can transition to the amount step.
 *
 * Side effects: none. This is a controlled, presentational component —
 * selection state lives in the parent (`DrawCreditPage`).
 */
export function CreditLineSelector({
  creditLines,
  onSelect,
  microProgressDescribedBy,
}: CreditLineSelectorProps) {
  // Decorate once so ordering and rendering share the same eligibility
  // decision. Eligible lines always sort before ineligible ones.
  const orderedLines = creditLines
    .map((line) => ({ line, eligibility: getDrawEligibility(line) }))
    .sort((a, b) => {
      if (a.eligibility.eligible !== b.eligibility.eligible) {
        return a.eligibility.eligible ? -1 : 1;
      }

      // Deterministic ordering within each group: highest available balance
      // first, then by name, and finally by id as a stable tie-breaker.
      if (a.line.available !== b.line.available) {
        return b.line.available - a.line.available;
      }
      return (
        a.line.name.localeCompare(b.line.name) ||
        String(a.line.id).localeCompare(String(b.line.id))
      );
    });

  return (
    <div className="dc-step">
      {/* Step header */}
      <div>
        <h2
          id="select-credit-line-heading"
          className="dc-step__title"
          aria-describedby={microProgressDescribedBy}
        >
          Select Credit Line
        </h2>
        <p className="dc-step__subtitle">
          Choose which line of credit to draw from
        </p>
      </div>

      {/* Credit-line list */}
      <ul className="dc-credit-line-list" role="list">
        {orderedLines.map(({ line, eligibility }) => {
          const isHighUtilization = line.utilization > 80;
          const copy = eligibility.eligible
            ? null
            : INELIGIBLE_COPY[eligibility.reason];
          const reasonId = `credit-line-${line.id}-reason`;

          return (
            <li key={line.id}>
              <button
                type="button"
                onClick={() => {
                  if (!eligibility.eligible) return;
                  onSelect(line);
                }}
                aria-disabled={copy ? "true" : undefined}
                aria-describedby={copy ? reasonId : undefined}
                aria-label={
                  copy
                    ? `${line.name} credit line unavailable: ${copy.message}`
                    : `Select ${line.name} credit line, available balance $${line.available.toLocaleString()}`
                }
                className="dc-credit-line-item"
              >
                <div className="dc-credit-line-item__inner">
                  <div className="dc-credit-line-item__body">
                    {/* Name */}
                    <div className="dc-credit-line-item__name">{line.name}</div>

                    {/* Meta row: available, utilization, warning badge */}
                    <div className="dc-credit-line-item__meta">
                      <div>
                        <span className="dc-credit-line-item__label">
                          Available:
                        </span>
                        <span className="dc-credit-line-item__value tabular-nums">
                          ${line.available.toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <span className="dc-credit-line-item__label">
                          Utilization:
                        </span>
                        <span
                          className={`num-tabular ${
                            isHighUtilization
                              ? "dc-credit-line-item__value--warning tabular-nums"
                              : "dc-credit-line-item__value tabular-nums"
                          }`}
                        >
                          {line.utilization}%
                        </span>
                      </div>

                      {/* High-utilization badge — announced as a status region */}
                      {isHighUtilization && (
                        <div
                          className="dc-credit-line-item__warning-badge"
                          role="status"
                        >
                          <AlertCircle
                            className="dc-banner__icon"
                            aria-hidden="true"
                          />
                          <span>High utilization</span>
                        </div>
                      )}
                    </div>

                    {/* Utilization progress bar */}
                    <div
                      className="dc-progress-track"
                      role="progressbar"
                      aria-valuenow={line.utilization}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${line.name} utilization: ${line.utilization}%`}
                    >
                      <div
                        className={`dc-progress-bar${isHighUtilization ? " dc-progress-bar--warning" : ""}`}
                        style={{ width: `${line.utilization}%` }}
                      />
                    </div>
                  </div>

                  {/* Chevron — colour handled by CSS hover rule on parent */}
                  <ChevronRight
                    className="dc-chevron"
                    width={20}
                    height={20}
                    aria-hidden="true"
                  />
                </div>
              </button>

              {copy && (
                <p id={reasonId} className="dc-credit-line-item__reason">
                  <Link
                    to={copy.href(line.id)}
                    className="dc-credit-line-item__reason-link"
                  >
                    {copy.message}
                  </Link>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
