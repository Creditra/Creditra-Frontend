import { useState, useMemo, type ReactNode } from 'react';
import { KbdHint } from '../components/KbdHint';
import {
  optimiseRepayment,
  type OptimiseRepaymentLine,
  type OptimisedRepaymentPlan,
  type RepaymentStrategy,
} from '../utils/suggestRepay';
import './SmartPayCTA.css';

export interface SmartPayCTAProps {
  /** The heading for the CTA card. */
  title: string;
  /** Body copy explaining the benefit. */
  description: string;
  /** Primary CTA element (button or link). */
  cta: ReactNode;
  /**
   * Optional image sources for responsive rendering.
   * The component renders a `<picture>` element with `<source>` tags
   * for multiple resolutions (mobile → desktop).
   */
  images?: { src: string; width: number }[];
  /** Alt text for the decorative image. */
  imageAlt?: string;
  /** Additional CSS class names. */
  className?: string;
  /**
   * Keyboard shortcut for the primary CTA (e.g. `['Ctrl', 'Enter']`).
   * When provided, a subtle hint chip is rendered next to the action.
   */
  shortcutKeys?: string | string[];
  /** Optional label shown alongside the shortcut hint chip. */
  shortcutLabel?: string;
  /**
   * Optional credit lines for the multi-line repayment optimiser.
   * When provided together with `budget`, renders the strategy toggle
   * (avalanche vs snowball), accessible rationale, and allocation table.
   */
  lines?: OptimiseRepaymentLine[];
  /** Available repayment budget in dollars for the optimiser. */
  budget?: number;
  /** Initial strategy selection (defaults to `'avalanche'`). */
  defaultStrategy?: RepaymentStrategy;
  /** Called when the user clicks "Apply plan" to prefill repayment amounts. */
  onApplyPlan?: (plan: OptimisedRepaymentPlan) => void;
}

const formatCurrency = (value: number): string =>
  `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/**
 * SmartPayCTA — responsive call-to-action card with srcset images and
 * optional multi-line repayment optimiser (avalanche vs snowball).
 *
 * WCAG 2.1 AA:
 * - Decorative images use `alt=""` (unless imageAlt is provided).
 * - CTA focus rings via `:focus-visible` in index.css.
 * - Strategy toggle uses `role="group"` with `aria-pressed` buttons.
 * - Rationale summary uses `role="status"` + `aria-live="polite"`.
 * - Allocation table uses semantic `<table>`, `<thead>`, and `scope="col"`.
 */
export function SmartPayCTA({
  title,
  description,
  cta,
  images,
  imageAlt = '',
  className = '',
  shortcutKeys,
  shortcutLabel,
  lines,
  budget,
  defaultStrategy = 'avalanche',
  onApplyPlan,
}: SmartPayCTAProps) {
  const [strategy, setStrategy] = useState<RepaymentStrategy>(defaultStrategy);
  const showOptimiser = Array.isArray(lines) && budget !== undefined;

  const plan = useMemo(
    () => (showOptimiser ? optimiseRepayment(lines, budget, strategy) : null),
    [showOptimiser, lines, budget, strategy],
  );

  const classes = ['card', 'smartpay-cta', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="smartpay-cta__body">
        <h2 className="smartpay-cta__title">{title}</h2>
        <p className="smartpay-cta__desc">{description}</p>

        {plan && (
          <div className="smartpay-cta__optimiser" data-testid="smartpay-optimiser">
            <div
              className="smartpay-cta__strategy-toggle"
              role="group"
              aria-label="Repayment strategy"
            >
              <button
                type="button"
                className={`smartpay-cta__strategy-btn${strategy === 'avalanche' ? ' smartpay-cta__strategy-btn--active' : ''}`}
                aria-pressed={strategy === 'avalanche'}
                onClick={() => setStrategy('avalanche')}
              >
                Avalanche (Highest APR)
              </button>
              <button
                type="button"
                className={`smartpay-cta__strategy-btn${strategy === 'snowball' ? ' smartpay-cta__strategy-btn--active' : ''}`}
                aria-pressed={strategy === 'snowball'}
                onClick={() => setStrategy('snowball')}
              >
                Snowball (Smallest Balance)
              </button>
            </div>

            <p
              className="smartpay-cta__rationale"
              role="status"
              aria-live="polite"
              data-testid="smartpay-rationale"
            >
              {plan.rationale}
            </p>

            {plan.allocations.length > 0 && (
              <div className="smartpay-cta__table-wrap">
                <table
                  className="smartpay-cta__table"
                  aria-label="Optimised repayment allocation"
                >
                  <thead>
                    <tr>
                      <th scope="col">Line</th>
                      <th scope="col">APR</th>
                      <th scope="col">Balance</th>
                      <th scope="col">Allocated</th>
                      <th scope="col">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.allocations.map((row) => (
                      <tr key={row.lineId} data-testid={`smartpay-row-${row.lineId}`}>
                        <td>
                          <span className="smartpay-cta__line-name">{row.lineName}</span>
                          <span className="smartpay-cta__line-rationale">{row.rationale}</span>
                        </td>
                        <td className="num-tabular">{row.apr}%</td>
                        <td className="num-tabular">{formatCurrency(row.balance)}</td>
                        <td className="num-tabular smartpay-cta__allocated">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="num-tabular">{formatCurrency(row.remainingBalance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {onApplyPlan && (
              <div className="smartpay-cta__apply">
                <button
                  type="button"
                  className="smartpay-cta__apply-btn"
                  disabled={plan.totalAllocated <= 0}
                  onClick={() => onApplyPlan(plan)}
                >
                  Apply plan ({formatCurrency(plan.totalAllocated)})
                </button>
              </div>
            )}
          </div>
        )}

        <div className="smartpay-cta__action">
          {cta}
          {shortcutKeys && (
            <KbdHint
              keys={shortcutKeys}
              label={shortcutLabel}
              variant="badge"
              className="smartpay-cta__shortcut-hint"
            />
          )}
        </div>
      </div>

      {images && images.length > 0 && (
        <div className="smartpay-cta__image" aria-hidden={!imageAlt}>
          <picture>
            {images
              .sort((a, b) => a.width - b.width)
              .map((img, idx) => (
                <source
                  key={idx}
                  srcSet={img.src}
                  media={
                    idx < images.length - 1
                      ? `(max-width: ${img.width}px)`
                      : undefined
                  }
                />
              ))}
            <img
              src={images[images.length - 1].src}
              alt={imageAlt}
              className="smartpay-cta__img"
            />
          </picture>
        </div>
      )}
    </div>
  );
}

export default SmartPayCTA;
