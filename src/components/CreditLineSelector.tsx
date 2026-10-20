/**
 * CreditLineSelector
 *
 * Step 1 of the draw-credit flow. Renders a list of available credit lines
 * for the user to choose from.
 *
 * Design-token classes used (all from `src/index.css` `.dc-*` block):
 *   dc-credit-line-list, dc-credit-line-item, dc-credit-line-item__name,
 *   dc-credit-line-item__meta, dc-credit-line-item__label,
 *   dc-credit-line-item__value, dc-credit-line-item__value--warning,
 *   dc-credit-line-item__warning-badge, dc-progress-track, dc-progress-bar,
 *   dc-progress-bar--warning, dc-chevron
 *
 * Accessibility:
 *   - Each button has an aria-label describing the credit line and available balance.
 *   - Utilization progress bar is a <div role="progressbar"> with aria-valuenow/min/max.
 *   - High-utilization badge has role="status" so it is announced by screen readers.
 */

import { CreditLine } from "@/types/draw-credit.types";
import { AlertCircle, ChevronRight } from "lucide-react";
import { formatMoney } from "@/utils/amountValidation";

interface CreditLineSelectorProps {
  /** Credit lines the user is eligible to draw from. */
  creditLines: CreditLine[];
  /**
   * Invoked when the user picks a line. The wizard advances to the
   * amount step on the next render — there is no internal selection
   * state in this component.
   */
  onSelect: (creditLine: CreditLine) => void;
  /**
   * Optional id of the header micro-indicator (`draw-wizard-micro-select`)
   * so the step heading is described by the wizard validity chip.
   */
  microProgressDescribedBy?: string;
}

/**
 * Step 1 of the draw-credit wizard.
 *
 * Renders the user's credit lines as a list of large click targets. Each
 * row shows the line name, available balance, current utilization, and a
 * "select" affordance. Picking a row calls `onSelect(creditLine)` so the
 * parent wizard can transition to the amount step.
 *
 * Side effects: none. This is a controlled, presentational component —
 * selection state lives in the parent (`DrawCreditPage`).
 *
 * Accessibility:
 * - Rows are real `<button>` elements with a descriptive `aria-label`
 *   (`Select <name> credit line, available balance <fmt>`).
 * - The step heading is exposed via `id="select-credit-line-heading"`
 *   so the parent can wire it as the labelling element for the wizard
 *   container.
 */
export function CreditLineSelector({
  creditLines,
  onSelect,
  microProgressDescribedBy,
}: CreditLineSelectorProps) {
  return (
    <div className="dc-step">
      {/* Step header */}
      <div>
        <h2 className="dc-step__title">Select Credit Line</h2>
        <p className="dc-step__subtitle">
          Choose which line of credit to draw from
        </p>
      </div>

      {/* Credit-line list */}
      <ul className="dc-credit-line-list" role="list">
        {[...creditLines]
          .sort((a, b) => {
            // Deterministic ordering: highest available balance first,
            // then by name, and finally by id as a stable tie-breaker.
            if (a.available !== b.available) return b.available - a.available;
            return a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id));
          })
          .map((line) => {
          const isHighUtilization = line.utilization > 80;

          return (
            <li key={line.id}>
              <button
                onClick={() => onSelect(line)}
                className="dc-credit-line-item"
                aria-label={`Select ${line.name} credit line, available balance $${line.available.toLocaleString()}`}
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
            </li>
          );
        })}
      </ul>
    </div>
  );
}
