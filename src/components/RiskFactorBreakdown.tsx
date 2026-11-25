/**
 * RiskFactorBreakdown
 *
 * Displays a table + bar visualisation of each attestation-derived risk factor,
 * showing its weight, contribution to the overall score, and trend direction.
 *
 * Accessibility
 * ─────────────────────────────────────────────────────────────────────────────
 * - The table uses `<th scope="col">` headers and `<th scope="row">` per row,
 *   so screen readers can associate cells with their headings.
 * - Trend indicators use a text label alongside the arrow icon — the arrow is
 *   `aria-hidden="true"` to avoid redundancy; the text carries the meaning
 *   (satisfies "trend not colour-only" acceptance criterion).
 * - The bar visualisation is `aria-hidden="true"` (redundant with the
 *   percentage value in the table cell).
 * - An empty-state message is rendered when `factors` is empty or absent,
 *   without crashing (satisfies "empty/partial data does not crash").
 *
 * Rounding policy
 * ─────────────────────────────────────────────────────────────────────────────
 * Contributions are displayed with one decimal place. The displayed sum will
 * match the gauge score within ±0.5 (floating-point rounding artefact from
 * rounding each contribution independently).
 */

import type { RiskFactor } from '../types/attestation';
import {
  computeRiskFactors,
  type ComputedRiskFactor,
} from '../lib/risk-factors';
import './RiskFactorBreakdown.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskFactorBreakdownProps {
  /**
   * Array of raw factors from the attestation layer. May be empty or absent;
   * both cases render the empty state without crashing.
   */
  factors?: RiskFactor[];
  /**
   * The scale of the gauge score (100 for the component gauge, 850 for the
   * page gauge). Contributions are computed as `weight × value × scale`.
   * @default 100
   */
  scale?: number;
  /**
   * Optional CSS class added to the outermost element.
   */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TREND_ICON: Record<ComputedRiskFactor['trend'], string> = {
  up: '▲',
  down: '▼',
  flat: '─',
};

const TREND_LABEL: Record<ComputedRiskFactor['trend'], string> = {
  up: 'Up',
  down: 'Down',
  flat: 'No change',
};

/**
 * Returns the CSS custom property for a bar colour based on how high the
 * factor's contribution is relative to its maximum possible contribution
 * (weight × scale).
 *
 * ≥70% of max → success
 * ≥50% of max → warning
 * <50% of max → error
 */
function barColorVar(factor: ComputedRiskFactor, scale: number): string {
  const max = factor.weight * scale;
  if (max === 0) return 'var(--muted)';
  const pct = factor.contribution / max;
  if (pct >= 0.7) return 'var(--success)';
  if (pct >= 0.5) return 'var(--warning)';
  return 'var(--error)';
}

/** Width percentage for the bar relative to the factor's maximum contribution. */
function barWidthPct(factor: ComputedRiskFactor, scale: number): number {
  const max = factor.weight * scale;
  if (max === 0) return 0;
  return Math.min(100, (factor.contribution / max) * 100);
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function FactorBreakdownEmpty() {
  return (
    <div className="rfb-empty" role="status" aria-live="polite">
      <span className="rfb-empty__icon" aria-hidden="true">📊</span>
      <p className="rfb-empty__text">
        No risk factor data is available yet. Factors will appear once your
        attestations have been evaluated.
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * RiskFactorBreakdown
 *
 * Renders a card with an accessible table listing each attestation-derived
 * factor, its weight (relative importance), contribution to the displayed
 * score, a bar visualisation, and a trend indicator.
 *
 * Mounts beside `RiskGauge` on the Risk Gauge page.
 */
export function RiskFactorBreakdown({
  factors,
  scale = 100,
  className = '',
}: RiskFactorBreakdownProps) {
  // Guard: empty / undefined input → empty state, no crash.
  if (!factors || factors.length === 0) {
    return (
      <section
        className={`card rfb-card ${className}`.trim()}
        aria-labelledby="rfb-heading"
      >
        <h2 id="rfb-heading" className="rfb-heading">
          <span className="rfb-heading__icon" aria-hidden="true">📋</span>
          Risk Factor Breakdown
        </h2>
        <FactorBreakdownEmpty />
      </section>
    );
  }

  // Compute contributions and trends. This may throw if weights don't sum to
  // 1; we let that bubble up so callers surface misconfiguration during dev.
  const computed = computeRiskFactors(factors, { scale });

  return (
    <section
      className={`card rfb-card ${className}`.trim()}
      aria-labelledby="rfb-heading"
    >
      <h2 id="rfb-heading" className="rfb-heading">
        <span className="rfb-heading__icon" aria-hidden="true">📋</span>
        Risk Factor Breakdown
      </h2>

      <div className="rfb-table-wrapper" role="region" aria-label="Risk factor details">
        <table className="rfb-table">
          <thead>
            <tr>
              <th scope="col" className="rfb-th rfb-th--factor">Factor</th>
              <th scope="col" className="rfb-th rfb-th--weight">Weight</th>
              <th scope="col" className="rfb-th rfb-th--contribution">
                Contribution
              </th>
              <th scope="col" className="rfb-th rfb-th--bar" aria-hidden="true">
                {/* Bar header — visual only; redundant with the Contribution column */}
              </th>
              <th scope="col" className="rfb-th rfb-th--trend">Trend</th>
            </tr>
          </thead>
          <tbody>
            {computed.map((factor) => {
              const color = barColorVar(factor, scale);
              const widthPct = barWidthPct(factor, scale);
              return (
                <tr key={factor.id} className="rfb-row">
                  <th scope="row" className="rfb-td rfb-td--factor">
                    {factor.label}
                  </th>
                  <td className="rfb-td rfb-td--weight">
                    {Math.round(factor.weight * 100)}%
                  </td>
                  <td className="rfb-td rfb-td--contribution">
                    {factor.contribution.toFixed(1)}
                  </td>
                  <td
                    className="rfb-td rfb-td--bar"
                    aria-hidden="true"
                  >
                    <div className="rfb-bar-track">
                      <div
                        className="rfb-bar-fill"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </td>
                  <td
                    className={`rfb-td rfb-td--trend rfb-trend--${factor.trend}`}
                  >
                    {/* Text label first so the semantic meaning is clear to AT */}
                    <span className="rfb-trend__label">
                      {TREND_LABEL[factor.trend]}
                    </span>
                    {/* Visual arrow — hidden from AT to avoid redundancy */}
                    <span
                      className="rfb-trend__icon"
                      aria-hidden="true"
                    >
                      {TREND_ICON[factor.trend]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="rfb-footnote">
        Contributions reflect each factor&apos;s weighted share of your score.
        Weights sum to 100%.
      </p>
    </section>
  );
}
