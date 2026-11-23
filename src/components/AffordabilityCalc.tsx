/**
 * AffordabilityCalc
 *
 * Estimates the maximum monthly repayment a borrower can comfortably afford.
 *
 * Calculation (28/36 rule – industry-standard):
 *   maxAffordable = (monthlyIncome × 0.36) − monthlyObligations
 *
 * The 36 % cap covers total debt payments. Result is clamped to ≥ 0.
 *
 * Props
 * -----
 * onApply  – optional; when provided, a "Use this amount" button lets the
 *            parent pre-fill its repayment amount input.
 */

import { useState, useMemo, useId } from 'react';
import { AccessibleTooltip } from './AccessibleTooltip';
import { formatMoney } from '@/utils/amountValidation';

/** Fraction of gross monthly income that may go toward total debt. */
export const DEBT_RATIO = 0.36;

/**
 * Strict currency parser — accepts only strings matching `^\d+(\.\d{1,2})?$`.
 *
 * Returns the parsed number on success, or `null` for any input that would be
 * silently mangled by `parseFloat` (e.g. `"12abc"`, `"1e3"`, `"-5"`, `""`).
 */
export function parseStrictAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Pure calculation – exported so it can be unit-tested independently.
 * Returns the max affordable monthly repayment (never negative).
 */
export function calcMaxAffordable(income: number, obligations: number): number {
  return Math.max(0, income * DEBT_RATIO - obligations);
}

export interface AffordabilityCalcProps {
  /** Called with the computed max when the user clicks "Use this amount". */
  onApply?: (amount: number) => void;
}

/**
 * AffordabilityCalc widget.
 *
 * Renders two currency inputs (monthly income, current obligations) and
 * displays the computed max affordable repayment with an accessible live
 * region. An optional "Use this amount" button propagates the result to
 * the parent repayment form.
 */
export function AffordabilityCalc({ onApply }: AffordabilityCalcProps) {
  const incomeId = useId();
  const obligationsId = useId();
  const incomeErrorId = useId();
  const obligationsErrorId = useId();

  const [incomeStr, setIncomeStr] = useState('');
  const [obligationsStr, setObligationsStr] = useState('');

  // Only show validation errors after the user has blurred the field once.
  const [incomeTouched, setIncomeTouched] = useState(false);
  const [obligationsTouched, setObligationsTouched] = useState(false);

  const incomeParsed = parseStrictAmount(incomeStr);
  const obligationsParsed = parseStrictAmount(obligationsStr);

  const incomeError =
    incomeTouched && incomeStr !== '' && incomeParsed === null
      ? 'Enter a valid amount (e.g. 5000 or 5000.00).'
      : null;

  const obligationsError =
    obligationsTouched && obligationsStr !== '' && obligationsParsed === null
      ? 'Enter a valid amount (e.g. 1200 or 1200.50).'
      : null;

  const income = incomeParsed ?? 0;
  const obligations = obligationsParsed ?? 0;

  const maxAffordable = useMemo(
    () => calcMaxAffordable(income, obligations),
    [income, obligations],
  );

  const hasResult = incomeParsed !== null && incomeParsed > 0;

  return (
    <section
      aria-labelledby="affordability-heading"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-center gap-2">
        <h2
          id="affordability-heading"
          className="text-xs font-semibold uppercase text-muted"
        >
          Affordability Calculator
        </h2>
        <AccessibleTooltip
          label={`Uses the 28/36 rule: max affordable = (monthly income × ${DEBT_RATIO * 100}%) − current obligations. Keeps your total debt-to-income ratio at or below 36%.`}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {/* Monthly income */}
        <div>
          <label
            htmlFor={incomeId}
            className="mb-1 block text-xs font-medium text-muted"
          >
            Monthly income
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id={incomeId}
              type="text"
              inputMode="decimal"
              value={incomeStr}
              onChange={(e) => setIncomeStr(e.target.value)}
              onBlur={() => setIncomeTouched(true)}
              placeholder="0.00"
              aria-label="Monthly income in US dollars"
              aria-invalid={incomeError !== null || undefined}
              aria-describedby={incomeError ? incomeErrorId : undefined}
              className={`w-full rounded-lg border bg-background py-2 pl-7 pr-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-accent ${
                incomeError ? 'border-error' : 'border-border'
              }`}
            />
          </div>
          {incomeError && (
            <p
              id={incomeErrorId}
              role="alert"
              className="mt-1 text-xs text-error"
            >
              {incomeError}
            </p>
          )}
        </div>

        {/* Current monthly obligations (rent, loans, etc.) */}
        <div>
          <label
            htmlFor={obligationsId}
            className="mb-1 block text-xs font-medium text-muted"
          >
            Current monthly obligations
          </label>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id={obligationsId}
              type="text"
              inputMode="decimal"
              value={obligationsStr}
              onChange={(e) => setObligationsStr(e.target.value)}
              onBlur={() => setObligationsTouched(true)}
              placeholder="0.00"
              aria-label="Current monthly obligations in US dollars"
              aria-invalid={obligationsError !== null || undefined}
              aria-describedby={obligationsError ? obligationsErrorId : undefined}
              className={`w-full rounded-lg border bg-background py-2 pl-7 pr-3 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-accent ${
                obligationsError ? 'border-error' : 'border-border'
              }`}
            />
          </div>
          {obligationsError && (
            <p
              id={obligationsErrorId}
              role="alert"
              className="mt-1 text-xs text-error"
            >
              {obligationsError}
            </p>
          )}
        </div>
      </div>

      {/* Result – only shown once the user has entered a valid income */}
      {hasResult && (
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg p-3"
          style={{
            background: 'rgba(63,185,80,0.08)',
            border: '1px solid rgba(63,185,80,0.25)',
          }}
          role="status"
          aria-live="polite"
          aria-label={`Max affordable repayment: ${formatMoney(maxAffordable)} per month`}
        >
          <div>
            <p className="text-xs text-muted">Max affordable repayment</p>
            <p
              className="mt-0.5 text-lg font-bold"
              style={{ color: 'var(--success, #3fb950)' }}
            >
              {formatMoney(maxAffordable)}
              <span className="ml-1 text-xs font-normal text-muted">/ month</span>
            </p>
          </div>

          {onApply && maxAffordable > 0 && (
            <button
              type="button"
              onClick={() => onApply(maxAffordable)}
              className="shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              style={{
                background: 'rgba(88,166,255,0.12)',
                color: 'var(--accent, #58a6ff)',
                border: '1px solid rgba(88,166,255,0.3)',
              }}
            >
              Use this amount
            </button>
          )}
        </div>
      )}
    </section>
  );
}
