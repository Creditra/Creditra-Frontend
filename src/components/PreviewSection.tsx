/**
 * PreviewSection
 *
 * Live draw summary rendered alongside the AmountInput step. Shows the
 * draw amount, projected new utilization, and two progress bars for
 * current vs. post-draw utilization.
 *
 * Design-token classes used (all from `src/index.css` `.dc-*` block):
 *   dc-section-label, dc-stat-grid, dc-stat-card, dc-stat-card--accent,
 *   dc-stat-card--success, dc-stat-card__header, dc-stat-card__label,
 *   dc-stat-card__value, dc-stat-card__icon, dc-util-section, dc-util-row,
 *   dc-util-row__label, dc-util-row__value, dc-util-row__value--warning,
 *   dc-progress-track, dc-progress-track--lg, dc-progress-bar,
 *   dc-progress-bar--warning
 *
 * Accessibility:
 *   - Each progress bar is a <div role="progressbar"> with aria-valuenow.
 *   - Stat card values have visually-clear colour associations backed by tokens.
 */

import { CreditLine } from "@/types/draw-credit.types";
import { DollarSign, TrendingUp } from "lucide-react";

interface PreviewSectionProps {
  creditLine: CreditLine;
  amount: number;
}

export function PreviewSection({ creditLine, amount }: PreviewSectionProps) {
  const newUtilization = Math.round(
    ((creditLine.limit - creditLine.available + amount) / creditLine.limit) *
      100,
  );
  const isHighAfterDraw = newUtilization > 80;

  return (
    <div className="dc-step">
      <h3 className="dc-section-label">Summary</h3>

      {/* Stat cards: draw amount + projected utilization */}
      <div className="dc-stat-grid">
        {/* Draw amount card — accent colour (var(--accent)) */}
        <div className="dc-stat-card dc-stat-card--accent">
          <div className="dc-stat-card__header">
            <div>
              <p className="dc-stat-card__label">Draw Amount</p>
              <p className="dc-stat-card__value tabular-nums">
                ${amount.toLocaleString()}
              </p>
            </div>
            <DollarSign
              className="dc-stat-card__icon dc-stat-card--accent dc-stat-card__icon"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* New utilization card — success colour (var(--success)) */}
        <div className="dc-stat-card dc-stat-card--success">
          <div className="dc-stat-card__header">
            <div>
              <p className="dc-stat-card__label">New Utilization</p>
              <p className="dc-stat-card__value tabular-nums">
                {newUtilization}%
              </p>
            </div>
            <TrendingUp
              className="dc-stat-card__icon dc-stat-card--success dc-stat-card__icon"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      {/* Current utilization progress bar */}
      <div className="dc-util-section">
        <div className="dc-util-row">
          <span className="dc-util-row__label">Current utilization</span>
          <span className="dc-util-row__value tabular-nums">{creditLine.utilization}%</span>
        </div>
        <div
          className="dc-progress-track dc-progress-track--lg"
          role="progressbar"
          aria-valuenow={creditLine.utilization}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Current utilization: ${creditLine.utilization}%`}
        >
          <div
            className="dc-progress-bar"
            style={{ width: `${creditLine.utilization}%` }}
          />
        </div>
      </div>

      {/* Post-draw utilization progress bar */}
      <div className="dc-util-section">
        <div className="dc-util-row">
          <span className="dc-util-row__label">After draw</span>
          <span
            className={`num-tabular ${
              isHighAfterDraw
                ? "dc-util-row__value--warning tabular-nums"
                : "dc-util-row__value tabular-nums"
            }`}
          >
            {newUtilization}%
          </span>
        </div>
        <div
          className="dc-progress-track dc-progress-track--lg"
          role="progressbar"
          aria-valuenow={newUtilization}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Utilization after draw: ${newUtilization}%`}
        >
          <div
            className={`dc-progress-bar${isHighAfterDraw ? " dc-progress-bar--warning" : ""}`}
            style={{ width: `${newUtilization}%` }}
          />
        </div>
      </div>
    </div>
  );
}
