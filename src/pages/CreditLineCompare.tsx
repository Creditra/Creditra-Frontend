/**
 * CreditLineCompare — /compare-credit-lines?a=<id>&b=<id>
 *
 * Full-page side-by-side comparison of two credit lines.
 * Accepts query params `a` and `b` that map to CreditLine IDs;
 * falls back to a picker UI when params are absent or invalid.
 *
 * Accessibility:
 *   - Every section is a <section> with an accessible heading.
 *   - Diff indicators carry aria-label explaining the change.
 *   - Focus-visible outlines and 44 × 44 px touch targets throughout.
 *   - Color is never the sole signal — diff rows also carry the ↑/↓ glyph
 *     and an aria-label.
 *   - High-contrast and dark-mode tokens used throughout (no inline hex).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import type { CreditLine } from '../types/creditLine';
import {
  COLOR,
  RISK_COLOR,
  STATUS_COLOR,
  fmt,
  fmtDate,
  getUtilizationLevel,
  utilizationPct,
  UTIL_COLOR,
} from '../utils/tokens';
import './CreditLineCompare.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Direction of a numeric difference for diff highlighting. */
type DiffDir = 'better' | 'worse' | 'neutral' | 'none';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the directional class and icon for a numeric diff row.
 *
 * @param a           Left column value
 * @param b           Right column value
 * @param higherBetter  Whether a higher number is "better" (e.g. limit, risk score).
 *                    Pass `false` for APR (lower = cheaper).
 */
function numericDiff(a: number, b: number, higherBetter: boolean): DiffDir {
  if (a === b) return 'none';
  const aWins = higherBetter ? a > b : a < b;
  // We return perspective from the left column (column A)
  return aWins ? 'better' : 'worse';
}

/** Readable direction label for screen readers. */
function diffAriaLabel(field: string, a: string, b: string, dir: DiffDir): string {
  if (dir === 'none') return `${field}: both lines have ${a}`;
  return `${field}: line A has ${a}, line B has ${b}. ${
    dir === 'better' ? 'Line A is better' : dir === 'worse' ? 'Line B is better' : 'Values differ'
  }`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Utilization progress bar. */
function UtilBar({ utilized, limit }: { utilized: number; limit: number }) {
  const pct = utilizationPct(utilized, limit);
  const level = getUtilizationLevel(utilized, limit);
  return (
    <div className="clc-util-bar" aria-label={`${pct}% utilized`}>
      <div
        className="clc-util-fill"
        style={{ width: `${pct}%`, background: UTIL_COLOR[level] }}
        role="presentation"
      />
    </div>
  );
}

/**
 * Single row inside the comparison table.
 * Renders two columns (A and B) with optional diff highlighting.
 */
function CompareRow({
  label,
  valueA,
  valueB,
  diffDir = 'none',
  ariaLabel,
  renderA,
  renderB,
}: {
  label: string;
  valueA: string;
  valueB: string;
  diffDir?: DiffDir;
  ariaLabel?: string;
  /** Custom renderer for the cell content (e.g. StatusBadge, progress bar). */
  renderA?: React.ReactNode;
  renderB?: React.ReactNode;
}) {
  const isDiff = diffDir !== 'none';

  const DiffIcon =
    diffDir === 'better'
      ? ArrowUpRight
      : diffDir === 'worse'
        ? ArrowDownRight
        : Minus;

  const diffColor =
    diffDir === 'better'
      ? COLOR.success
      : diffDir === 'worse'
        ? COLOR.error
        : COLOR.muted;

  return (
    <tr
      className={`clc-row${isDiff ? ' clc-row--diff' : ''}`}
      aria-label={ariaLabel ?? (isDiff ? diffAriaLabel(label, valueA, valueB, diffDir) : undefined)}
    >
      {/* Row header */}
      <th scope="row" className="clc-row-label">
        {label}
      </th>

      {/* Column A */}
      <td className={`clc-cell clc-cell--a${isDiff && diffDir === 'better' ? ' clc-cell--winner' : ''}`}>
        {renderA ?? <span className="clc-value">{valueA}</span>}
        {isDiff && (
          <span className="clc-diff-indicator" aria-hidden="true" style={{ color: diffColor }}>
            <DiffIcon size={14} />
          </span>
        )}
      </td>

      {/* Column B */}
      <td className={`clc-cell clc-cell--b${isDiff && diffDir === 'worse' ? ' clc-cell--winner' : ''}`}>
        {renderB ?? <span className="clc-value">{valueB}</span>}
        {isDiff && (
          <span className="clc-diff-indicator clc-diff-indicator--b" aria-hidden="true" style={{ color: diffDir === 'worse' ? COLOR.success : COLOR.error }}>
            {diffDir === 'better'
              ? <ArrowDownRight size={14} />
              : <ArrowUpRight size={14} />
            }
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Credit Line Picker ───────────────────────────────────────────────────────

/**
 * Shown when fewer than two valid IDs are supplied via query params.
 * Lets the user pick two credit lines and then updates the URL.
 */
function LinePicker() {
  const [, setSearchParams] = useSearchParams();
  const [pickA, setPickA] = useState('');
  const [pickB, setPickB] = useState('');

  const canCompare = pickA && pickB && pickA !== pickB;

  function handleCompare() {
    if (!canCompare) return;
    setSearchParams({ a: pickA, b: pickB });
  }

  return (
    <section className="clc-picker" aria-labelledby="clc-picker-heading">
      <h2 id="clc-picker-heading" className="clc-picker-heading">
        Select two credit lines to compare
      </h2>
      <p className="clc-picker-description">
        Choose any two credit lines below to view a detailed side-by-side comparison.
      </p>

      <div className="clc-picker-selects">
        <div className="clc-picker-field">
          <label htmlFor="pick-a" className="clc-picker-label">
            Credit Line A
          </label>
          <select
            id="pick-a"
            className="clc-picker-select"
            value={pickA}
            onChange={(e) => setPickA(e.target.value)}
          >
            <option value="">— Select a line —</option>
            {MOCK_CREDIT_LINES.filter((l) => l.id !== pickB).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.id})
              </option>
            ))}
          </select>
        </div>

        <div className="clc-picker-vs" aria-hidden="true">
          vs
        </div>

        <div className="clc-picker-field">
          <label htmlFor="pick-b" className="clc-picker-label">
            Credit Line B
          </label>
          <select
            id="pick-b"
            className="clc-picker-select"
            value={pickB}
            onChange={(e) => setPickB(e.target.value)}
          >
            <option value="">— Select a line —</option>
            {MOCK_CREDIT_LINES.filter((l) => l.id !== pickA).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        className="clc-compare-btn"
        onClick={handleCompare}
        disabled={!canCompare}
        aria-disabled={!canCompare}
      >
        Compare Lines
      </button>
    </section>
  );
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

/** Renders the full comparison table for two resolved CreditLine objects. */
function CompareTable({ lineA, lineB }: { lineA: CreditLine; lineB: CreditLine }) {
  const pctA = utilizationPct(lineA.utilized, lineA.limit);
  const pctB = utilizationPct(lineB.utilized, lineB.limit);

  const availableA = lineA.limit - lineA.utilized;
  const availableB = lineB.limit - lineB.utilized;

  // Derive diff directions
  const limitDiff    = numericDiff(lineA.limit,     lineB.limit,     true);
  const utilDiff     = numericDiff(lineA.utilized,  lineB.utilized,  false);
  const availableDiff = numericDiff(availableA,     availableB,      true);
  const aprDiff      = numericDiff(lineA.apr,       lineB.apr,       false); // lower APR = better
  const riskDiff     = numericDiff(lineA.riskScore, lineB.riskScore, true);  // higher score = better
  const pctDiff      = numericDiff(pctA,            pctB,            false); // lower utilization pct = better

  return (
    <div className="clc-table-wrapper" role="region" aria-label="Credit line comparison table">
      <table className="clc-table" aria-label={`Comparing ${lineA.name} and ${lineB.name}`}>
        <caption className="clc-table-caption">
          Side-by-side comparison. Highlighted rows show where values differ.
          Arrows indicate which line has the more favorable value.
        </caption>

        {/* Column headers */}
        <thead>
          <tr>
            <th scope="col" className="clc-th-label">
              <span className="sr-only">Metric</span>
            </th>
            <th scope="col" className="clc-th clc-th--a">
              <span className="clc-th-tag" aria-hidden="true">A</span>
              <span className="clc-th-name">{lineA.name}</span>
              <span className="clc-th-id">{lineA.id}</span>
            </th>
            <th scope="col" className="clc-th clc-th--b">
              <span className="clc-th-tag" aria-hidden="true">B</span>
              <span className="clc-th-name">{lineB.name}</span>
              <span className="clc-th-id">{lineB.id}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {/* ── Status ── */}
          <tr className="clc-row-group-header">
            <td colSpan={3}>Overview</td>
          </tr>

          <CompareRow
            label="Status"
            valueA={lineA.status}
            valueB={lineB.status}
            diffDir={lineA.status !== lineB.status ? 'neutral' : 'none'}
            renderA={<StatusBadge status={lineA.status} />}
            renderB={<StatusBadge status={lineB.status} />}
          />

          <CompareRow
            label="Opened"
            valueA={fmtDate(lineA.openedAt)}
            valueB={fmtDate(lineB.openedAt)}
            diffDir={lineA.openedAt !== lineB.openedAt ? 'neutral' : 'none'}
          />

          <CompareRow
            label="Collateral"
            valueA={lineA.collateral ?? '—'}
            valueB={lineB.collateral ?? '—'}
            diffDir={lineA.collateral !== lineB.collateral ? 'neutral' : 'none'}
          />

          {/* ── Financials ── */}
          <tr className="clc-row-group-header">
            <td colSpan={3}>Financials</td>
          </tr>

          <CompareRow
            label="Credit Limit"
            valueA={fmt(lineA.limit)}
            valueB={fmt(lineB.limit)}
            diffDir={limitDiff}
          />

          <CompareRow
            label="Utilized"
            valueA={fmt(lineA.utilized)}
            valueB={fmt(lineB.utilized)}
            diffDir={utilDiff}
          />

          <CompareRow
            label="Available"
            valueA={fmt(availableA)}
            valueB={fmt(availableB)}
            diffDir={availableDiff}
          />

          {/* Utilization % with progress bars */}
          <tr
            className={`clc-row${pctDiff !== 'none' ? ' clc-row--diff' : ''}`}
            aria-label={diffAriaLabel('Utilization', `${pctA}%`, `${pctB}%`, pctDiff)}
          >
            <th scope="row" className="clc-row-label">Utilization %</th>
            <td className={`clc-cell clc-cell--a${pctDiff === 'better' ? ' clc-cell--winner' : ''}`}>
              <span className="clc-value" style={{ color: UTIL_COLOR[getUtilizationLevel(lineA.utilized, lineA.limit)] }}>
                {pctA}%
              </span>
              <UtilBar utilized={lineA.utilized} limit={lineA.limit} />
            </td>
            <td className={`clc-cell clc-cell--b${pctDiff === 'worse' ? ' clc-cell--winner' : ''}`}>
              <span className="clc-value" style={{ color: UTIL_COLOR[getUtilizationLevel(lineB.utilized, lineB.limit)] }}>
                {pctB}%
              </span>
              <UtilBar utilized={lineB.utilized} limit={lineB.limit} />
            </td>
          </tr>

          {/* ── Pricing & Risk ── */}
          <tr className="clc-row-group-header">
            <td colSpan={3}>Pricing &amp; Risk</td>
          </tr>

          <CompareRow
            label="APR"
            valueA={`${lineA.apr}%`}
            valueB={`${lineB.apr}%`}
            diffDir={aprDiff}
          />

          {/* Risk score with color indicator */}
          <tr
            className={`clc-row${riskDiff !== 'none' ? ' clc-row--diff' : ''}`}
            aria-label={diffAriaLabel('Risk Score', String(lineA.riskScore), String(lineB.riskScore), riskDiff)}
          >
            <th scope="row" className="clc-row-label">Risk Score</th>
            <td className={`clc-cell clc-cell--a${riskDiff === 'better' ? ' clc-cell--winner' : ''}`}>
              <span
                className="clc-risk-score"
                style={{ color: RISK_COLOR(lineA.riskScore) }}
                aria-label={`Risk score ${lineA.riskScore}`}
              >
                {lineA.riskScore}
              </span>
              {riskDiff !== 'none' && (
                <span className="clc-diff-indicator" aria-hidden="true" style={{ color: riskDiff === 'better' ? COLOR.success : COLOR.error }}>
                  {riskDiff === 'better' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </span>
              )}
            </td>
            <td className={`clc-cell clc-cell--b${riskDiff === 'worse' ? ' clc-cell--winner' : ''}`}>
              <span
                className="clc-risk-score"
                style={{ color: RISK_COLOR(lineB.riskScore) }}
                aria-label={`Risk score ${lineB.riskScore}`}
              >
                {lineB.riskScore}
              </span>
              {riskDiff !== 'none' && (
                <span className="clc-diff-indicator clc-diff-indicator--b" aria-hidden="true" style={{ color: riskDiff === 'worse' ? COLOR.success : COLOR.error }}>
                  {riskDiff === 'better' ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                </span>
              )}
            </td>
          </tr>

          {/* ── Payments ── */}
          <tr className="clc-row-group-header">
            <td colSpan={3}>Upcoming Payments</td>
          </tr>

          <CompareRow
            label="Next Payment"
            valueA={lineA.nextPaymentDate ? fmtDate(lineA.nextPaymentDate) : '—'}
            valueB={lineB.nextPaymentDate ? fmtDate(lineB.nextPaymentDate) : '—'}
            diffDir={
              (lineA.nextPaymentDate ?? '') !== (lineB.nextPaymentDate ?? '') ? 'neutral' : 'none'
            }
          />

          <CompareRow
            label="Next Amount"
            valueA={lineA.nextPaymentAmount != null ? fmt(lineA.nextPaymentAmount) : '—'}
            valueB={lineB.nextPaymentAmount != null ? fmt(lineB.nextPaymentAmount) : '—'}
            diffDir={
              lineA.nextPaymentAmount != null && lineB.nextPaymentAmount != null
                ? numericDiff(lineA.nextPaymentAmount, lineB.nextPaymentAmount, false)
                : lineA.nextPaymentAmount !== lineB.nextPaymentAmount
                  ? 'neutral'
                  : 'none'
            }
          />

          <CompareRow
            label="Next Interest Accrual"
            valueA={lineA.nextInterestAccrualDate ? fmtDate(lineA.nextInterestAccrualDate) : '—'}
            valueB={lineB.nextInterestAccrualDate ? fmtDate(lineB.nextInterestAccrualDate) : '—'}
            diffDir={
              (lineA.nextInterestAccrualDate ?? '') !== (lineB.nextInterestAccrualDate ?? '')
                ? 'neutral'
                : 'none'
            }
          />

          {/* ── Activity ── */}
          <tr className="clc-row-group-header">
            <td colSpan={3}>Activity</td>
          </tr>

          <CompareRow
            label="Transactions"
            valueA={String(lineA.transactions.length)}
            valueB={String(lineB.transactions.length)}
            diffDir={
              lineA.transactions.length !== lineB.transactions.length ? 'neutral' : 'none'
            }
          />

          <CompareRow
            label="Last Updated"
            valueA={fmtDate(lineA.updatedAt)}
            valueB={fmtDate(lineB.updatedAt)}
            diffDir={lineA.updatedAt !== lineB.updatedAt ? 'neutral' : 'none'}
          />
        </tbody>
      </table>
    </div>
  );
}

// ─── Summary Scorecard ────────────────────────────────────────────────────────

/**
 * Compact summary underneath the table showing how many metrics each line
 * "wins" — gives a quick visual tally without over-prescribing a winner.
 */
function Scorecard({ lineA, lineB }: { lineA: CreditLine; lineB: CreditLine }) {
  const pctA = utilizationPct(lineA.utilized, lineA.limit);
  const pctB = utilizationPct(lineB.utilized, lineB.limit);
  const availableA = lineA.limit - lineA.utilized;
  const availableB = lineB.limit - lineB.utilized;

  const metrics: { dir: DiffDir }[] = [
    { dir: numericDiff(lineA.limit,      lineB.limit,      true)  },
    { dir: numericDiff(lineA.utilized,   lineB.utilized,   false) },
    { dir: numericDiff(availableA,       availableB,       true)  },
    { dir: numericDiff(pctA,             pctB,             false) },
    { dir: numericDiff(lineA.apr,        lineB.apr,        false) },
    { dir: numericDiff(lineA.riskScore,  lineB.riskScore,  true)  },
  ];

  const winsA = metrics.filter((m) => m.dir === 'better').length;
  const winsB = metrics.filter((m) => m.dir === 'worse').length;
  const ties  = metrics.filter((m) => m.dir === 'none').length;

  return (
    <section className="clc-scorecard" aria-labelledby="clc-scorecard-heading">
      <h3 id="clc-scorecard-heading" className="clc-scorecard-heading">
        Metric Summary
      </h3>
      <p className="clc-scorecard-description">
        Across the six quantitative metrics above (limit, utilization, available, utilization %, APR,
        and risk score), here is how the lines compare:
      </p>
      <div className="clc-scorecard-grid" role="list">
        <div className="clc-scorecard-item clc-scorecard-item--a" role="listitem">
          <span className="clc-scorecard-tag" aria-hidden="true">A</span>
          <span className="clc-scorecard-label">{lineA.name}</span>
          <span className="clc-scorecard-wins" aria-label={`${lineA.name} wins ${winsA} of ${metrics.length} metrics`}>
            {winsA} / {metrics.length}
          </span>
        </div>
        <div className="clc-scorecard-item clc-scorecard-item--ties" role="listitem">
          <span className="clc-scorecard-label">Ties</span>
          <span className="clc-scorecard-wins" aria-label={`${ties} metrics are equal`}>{ties}</span>
        </div>
        <div className="clc-scorecard-item clc-scorecard-item--b" role="listitem">
          <span className="clc-scorecard-tag" aria-hidden="true">B</span>
          <span className="clc-scorecard-label">{lineB.name}</span>
          <span className="clc-scorecard-wins" aria-label={`${lineB.name} wins ${winsB} of ${metrics.length} metrics`}>
            {winsB} / {metrics.length}
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * CreditLineCompare — route: /compare-credit-lines
 *
 * URL params:
 *   a   — ID of the first credit line  (e.g. ?a=CL-2024-001)
 *   b   — ID of the second credit line (e.g. &b=CL-2024-002)
 *
 * When both params are present and valid the page renders the full comparison.
 * Otherwise, a picker is shown to let the user choose two lines.
 */
export default function CreditLineCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOverride, setPickerOverride] = useState(false);

  const idA = searchParams.get('a') ?? '';
  const idB = searchParams.get('b') ?? '';

  const lineA = useMemo(
    () => MOCK_CREDIT_LINES.find((l) => l.id === idA) ?? null,
    [idA],
  );
  const lineB = useMemo(
    () => MOCK_CREDIT_LINES.find((l) => l.id === idB) ?? null,
    [idB],
  );

  const bothFound = lineA !== null && lineB !== null;

  useEffect(() => {
    if (!idA && !idB) {
      setPickerOverride(false);
    }
  }, [idA, idB]);

  /** Swap the two lines in the URL, keeping the rest of the UI intact. */
  function handleSwap() {
    setSearchParams({ a: idB, b: idA }, { replace: true });
    setPickerOverride(false);
  }

  /** Clear selection and return to the picker. */
  function handleClear() {
    setSearchParams({}, { replace: true });
    setPickerOverride(true);
  }

  return (
    <main className="clc-page" aria-labelledby="clc-heading">
      {/* ── Page header ── */}
      <div className="clc-page-header">
        <Link to="/credit-lines" className="clc-back-link" aria-label="Back to Credit Lines list">
          <ArrowLeft size={16} aria-hidden="true" />
          Credit Lines
        </Link>

        <div className="clc-heading-row">
          <h1 id="clc-heading" className="clc-heading">
            Compare Credit Lines
          </h1>

          {bothFound && (
            <div className="clc-header-actions">
              <button
                type="button"
                className="clc-action-btn"
                onClick={handleSwap}
                aria-label="Swap the positions of line A and line B"
              >
                ⇄ Swap
              </button>
              <button
                type="button"
                className="clc-action-btn clc-action-btn--ghost"
                onClick={handleClear}
                aria-label="Clear selection and choose different credit lines"
              >
                Change Lines
              </button>
            </div>
          )}
        </div>

        {bothFound && (
          <p className="clc-heading-description">
            Comparing{' '}
            <strong style={{ color: STATUS_COLOR[lineA.status].color }}>
              {lineA.name}
            </strong>{' '}
            (A) with{' '}
            <strong style={{ color: STATUS_COLOR[lineB.status].color }}>
              {lineB.name}
            </strong>{' '}
            (B). Highlighted rows show where the lines differ.
          </p>
        )}
      </div>

      {/* ── Picker or Comparison ── */}
      {bothFound && !pickerOverride ? (
        <>
          <CompareTable lineA={lineA} lineB={lineB} />
          <Scorecard lineA={lineA} lineB={lineB} />
        </>
      ) : (
        <>
          {/* Show an error message if params were supplied but not found */}
          {(idA || idB) && (
            <div role="alert" className="clc-invalid-params" aria-live="polite">
              {idA && !lineA && (
                <p>Credit line <code>{idA}</code> was not found.</p>
              )}
              {idB && !lineB && (
                <p>Credit line <code>{idB}</code> was not found.</p>
              )}
            </div>
          )}
          <LinePicker />
        </>
      )}
    </main>
  );
}
