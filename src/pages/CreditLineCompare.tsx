/**
 * CreditLineCompare — /compare-credit-lines?ids=<id>,<id>,...
 *
 * Full-page side-by-side comparison of 2 to 4 credit lines.
 * Accepts URL query param `ids` (comma-separated IDs) as well as legacy `a` and `b`.
 * Falls back to a picker UI when fewer than two valid lines are supplied.
 *
 * Accessibility:
 *   - Every section is a <section> with an accessible heading.
 *   - Diff indicators carry aria-label explaining the change.
 *   - Focus-visible outlines and 44 × 44 px touch targets throughout.
 *   - Color is never the sole signal — diff rows also carry glyphs and aria-labels.
 *   - High-contrast and dark-mode tokens used throughout.
 *   - Sticky first column with horizontal scrolling on compact viewports.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { useCreditLines } from '../hooks/useCreditLines';
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
import {
  MAX_COMPARE,
  buildComparisonUrl,
  parseComparisonIdsFromSearchParams,
} from '../utils/comparisonSelection';
import './CreditLineCompare.css';

// ─── Constants & Types ────────────────────────────────────────────────────────

export const COLUMN_TAGS = ['A', 'B', 'C', 'D'] as const;

/** Direction of a numeric difference for diff highlighting. */
type DiffDir = 'better' | 'worse' | 'neutral' | 'none';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the directional class and icon for a 2-line comparison perspective.
 */
function numericDiff(a: number, b: number, higherBetter: boolean): DiffDir {
  if (a === b) return 'none';
  const aWins = higherBetter ? a > b : a < b;
  return aWins ? 'better' : 'worse';
}

/** Readable direction label for screen readers. */
function diffAriaLabel(
  field: string,
  values: string[],
  lines: CreditLine[],
  bestIndices: number[],
): string {
  if (lines.length === 2) {
    const [a, b] = values;
    if (a === b) return `${field}: both lines have ${a}`;
    const dir = bestIndices.includes(0)
      ? 'better'
      : bestIndices.includes(1)
        ? 'worse'
        : 'none';
    return `${field}: line A has ${a}, line B has ${b}. ${
      dir === 'better'
        ? 'Line A is better'
        : dir === 'worse'
          ? 'Line B is better'
          : 'Values differ'
    }`;
  }

  const descriptions = lines
    .map(
      (l, idx) =>
        `line ${COLUMN_TAGS[idx] ?? String(idx + 1)} (${l.name}) has ${values[idx]}`,
    )
    .join(', ');

  const bestDesc =
    bestIndices.length > 0 && bestIndices.length < lines.length
      ? ` Most favorable: ${bestIndices
          .map((i) => `Line ${COLUMN_TAGS[i] ?? String(i + 1)}`)
          .join(', ')}.`
      : '';

  return `${field}: ${descriptions}.${bestDesc}`;
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

interface RowCellConfig {
  value: string;
  render?: React.ReactNode;
  isWinner?: boolean;
  diffIcon?: 'up' | 'down' | 'none';
  diffColor?: string;
}

/**
 * Multi-column comparison row across 2 to 4 credit lines.
 */
function GeneralizedCompareRow({
  label,
  cells,
  isDiff,
  ariaLabel,
}: {
  label: string;
  cells: RowCellConfig[];
  isDiff: boolean;
  ariaLabel?: string;
}) {
  return (
    <tr
      className={`clc-row${isDiff ? ' clc-row--diff' : ''}`}
      aria-label={ariaLabel}
    >
      <th scope="row" className="clc-row-label">
        {label}
      </th>
      {cells.map((cell, idx) => {
        const tag = COLUMN_TAGS[idx]?.toLowerCase() ?? String(idx);
        const Icon =
          cell.diffIcon === 'up'
            ? ArrowUpRight
            : cell.diffIcon === 'down'
              ? ArrowDownRight
              : Minus;

        return (
          <td
            key={idx}
            className={`clc-cell clc-cell--${tag}${cell.isWinner ? ' clc-cell--winner' : ''}`}
          >
            {cell.render ?? <span className="clc-value">{cell.value}</span>}
            {isDiff && cell.diffIcon && cell.diffIcon !== 'none' && (
              <span
                className={`clc-diff-indicator clc-diff-indicator--${tag}`}
                aria-hidden="true"
                style={{ color: cell.diffColor ?? COLOR.muted }}
              >
                <Icon size={14} />
              </span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Credit Line Picker ───────────────────────────────────────────────────────

/**
 * Shown when fewer than two valid IDs are supplied via query params.
 * Lets the user pick between two and four credit lines and updates the URL.
 */
function LinePicker({
  lines,
  initialSelected = [],
}: {
  lines: CreditLine[];
  initialSelected?: string[];
}) {
  const [, setSearchParams] = useSearchParams();
  const [pickA, setPickA] = useState(initialSelected[0] ?? '');
  const [pickB, setPickB] = useState(initialSelected[1] ?? '');
  const [pickC, setPickC] = useState(initialSelected[2] ?? '');
  const [pickD, setPickD] = useState(initialSelected[3] ?? '');

  const chosenIds = [pickA, pickB, pickC, pickD].filter(Boolean);
  const canCompare = chosenIds.length >= 2;

  function handleCompare() {
    if (!canCompare) return;
    setSearchParams({ ids: chosenIds.join(',') });
  }

  return (
    <section className="clc-picker" aria-labelledby="clc-picker-heading">
      <h2 id="clc-picker-heading" className="clc-picker-heading">
        Select two credit lines (up to four) to compare
      </h2>
      <p className="clc-picker-description">
        Choose 2 to 4 credit lines below to view a detailed side-by-side comparison.
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
            {lines
              .filter((l) => l.id !== pickB && l.id !== pickC && l.id !== pickD)
              .map((l) => (
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
            {lines
              .filter((l) => l.id !== pickA && l.id !== pickC && l.id !== pickD)
              .map((l) => (
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
          <label htmlFor="pick-c" className="clc-picker-label">
            Credit Line C (optional)
          </label>
          <select
            id="pick-c"
            className="clc-picker-select"
            value={pickC}
            onChange={(e) => setPickC(e.target.value)}
          >
            <option value="">— Optional —</option>
            {lines
              .filter((l) => l.id !== pickA && l.id !== pickB && l.id !== pickD)
              .map((l) => (
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
          <label htmlFor="pick-d" className="clc-picker-label">
            Credit Line D (optional)
          </label>
          <select
            id="pick-d"
            className="clc-picker-select"
            value={pickD}
            onChange={(e) => setPickD(e.target.value)}
          >
            <option value="">— Optional —</option>
            {lines
              .filter((l) => l.id !== pickA && l.id !== pickB && l.id !== pickC)
              .map((l) => (
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

/** Renders the comparison table for resolved CreditLine objects (2 to 4). */
function CompareTable({ lines }: { lines: CreditLine[] }) {
  const lineA = lines[0];
  const lineB = lines[1];

  // Helper for numeric diff computation
  function buildNumericRow(
    label: string,
    getVal: (l: CreditLine) => number,
    formatVal: (val: number) => string,
    higherBetter: boolean,
  ) {
    const rawNums = lines.map(getVal);
    const hasDiff = rawNums.some((v) => v !== rawNums[0]);
    const bestVal = higherBetter ? Math.max(...rawNums) : Math.min(...rawNums);
    const bestIndices = hasDiff
      ? rawNums
          .map((v, i) => (v === bestVal ? i : -1))
          .filter((i) => i !== -1)
      : [];

    const cells: RowCellConfig[] = lines.map((l, idx) => {
      const val = rawNums[idx];
      const isWinner = hasDiff && bestIndices.includes(idx);
      let diffIcon: 'up' | 'down' | 'none' = 'none';
      let diffColor: string | undefined;

      if (hasDiff) {
        if (isWinner) {
          diffIcon = higherBetter ? 'up' : 'down';
          diffColor = COLOR.success;
        } else {
          diffIcon = higherBetter ? 'down' : 'up';
          diffColor = COLOR.error;
        }
      }

      return {
        value: formatVal(val),
        isWinner,
        diffIcon,
        diffColor,
      };
    });

    const valStrings = rawNums.map(formatVal);
    const aria = diffAriaLabel(label, valStrings, lines, bestIndices);

    return { label, cells, isDiff: hasDiff, ariaLabel: aria };
  }

  // Helper for categorical / text row
  function buildTextRow(
    label: string,
    getVal: (l: CreditLine) => string,
    renderCell?: (l: CreditLine) => React.ReactNode,
  ) {
    const valStrings = lines.map(getVal);
    const hasDiff = valStrings.some((v) => v !== valStrings[0]);
    const cells: RowCellConfig[] = lines.map((l, idx) => ({
      value: valStrings[idx],
      render: renderCell ? renderCell(l) : undefined,
    }));
    const aria = diffAriaLabel(label, valStrings, lines, []);
    return { label, cells, isDiff: hasDiff, ariaLabel: aria };
  }

  const limitRow = buildNumericRow('Credit Limit', (l) => l.limit, fmt, true);
  const utilizedRow = buildNumericRow('Utilized', (l) => l.utilized, fmt, false);
  const availableRow = buildNumericRow(
    'Available',
    (l) => l.limit - l.utilized,
    fmt,
    true,
  );
  const aprRow = buildNumericRow('APR', (l) => l.apr, (v) => `${v}%`, false);
  const riskRow = buildNumericRow(
    'Risk Score',
    (l) => l.riskScore,
    String,
    true,
  );

  // Utilization percentage row
  const pctValues = lines.map((l) => utilizationPct(l.utilized, l.limit));
  const pctDiff = pctValues.some((p) => p !== pctValues[0]);
  const bestPct = Math.min(...pctValues);
  const bestPctIndices = pctDiff
    ? pctValues
        .map((p, i) => (p === bestPct ? i : -1))
        .filter((i) => i !== -1)
    : [];

  return (
    <div
      className="clc-table-wrapper"
      role="region"
      aria-label="Credit line comparison table"
      tabIndex={0}
    >
      <table
        className="clc-table"
        aria-label={`Comparing ${lines.map((l) => l.name).join(' and ')}`}
      >
        <caption className="clc-table-caption">
          Side-by-side comparison of {lines.length} credit lines. Highlighted
          rows show where values differ. Arrows indicate which line has the more
          favorable value.
        </caption>

        {/* Column headers */}
        <thead>
          <tr>
            <th scope="col" className="clc-th-label">
              <span className="sr-only">Metric</span>
            </th>
            {lines.map((line, idx) => (
              <th
                key={`${line.id}-${idx}`}
                scope="col"
                className={`clc-th clc-th--${COLUMN_TAGS[idx]?.toLowerCase() ?? String(idx)}`}
              >
                <span className="clc-th-tag" aria-hidden="true">
                  {COLUMN_TAGS[idx] ?? String(idx + 1)}
                </span>
                <span className="clc-th-name">{line.name}</span>
                <span className="clc-th-id">{line.id}</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* ── Status / Overview ── */}
          <tr className="clc-row-group-header">
            <td colSpan={lines.length + 1}>Overview</td>
          </tr>

          {(() => {
            const row = buildTextRow(
              'Status',
              (l) => l.status,
              (l) => <StatusBadge status={l.status} />,
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {(() => {
            const row = buildTextRow('Opened', (l) => fmtDate(l.openedAt));
            return <GeneralizedCompareRow {...row} />;
          })()}

          {(() => {
            const row = buildTextRow(
              'Collateral',
              (l) => l.collateral ?? '—',
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {/* ── Financials ── */}
          <tr className="clc-row-group-header">
            <td colSpan={lines.length + 1}>Financials</td>
          </tr>

          <GeneralizedCompareRow {...limitRow} />
          <GeneralizedCompareRow {...utilizedRow} />
          <GeneralizedCompareRow {...availableRow} />

          {/* Utilization % row */}
          <tr
            className={`clc-row${pctDiff ? ' clc-row--diff' : ''}`}
            aria-label={diffAriaLabel(
              'Utilization',
              pctValues.map((p) => `${p}%`),
              lines,
              bestPctIndices,
            )}
          >
            <th scope="row" className="clc-row-label">
              Utilization %
            </th>
            {lines.map((l, idx) => {
              const tag = COLUMN_TAGS[idx]?.toLowerCase() ?? String(idx);
              const pct = pctValues[idx];
              const isWinner = pctDiff && bestPctIndices.includes(idx);

              return (
                <td
                  key={`${l.id}-${idx}`}
                  className={`clc-cell clc-cell--${tag}${isWinner ? ' clc-cell--winner' : ''}`}
                >
                  <span
                    className="clc-value"
                    style={{
                      color:
                        UTIL_COLOR[
                          getUtilizationLevel(l.utilized, l.limit)
                        ],
                    }}
                  >
                    {pct}%
                  </span>
                  <UtilBar utilized={l.utilized} limit={l.limit} />
                </td>
              );
            })}
          </tr>

          {/* ── Pricing & Risk ── */}
          <tr className="clc-row-group-header">
            <td colSpan={lines.length + 1}>Pricing &amp; Risk</td>
          </tr>

          <GeneralizedCompareRow {...aprRow} />

          {/* Risk Score row */}
          {(() => {
            const rawScores = lines.map((l) => l.riskScore);
            const scoreDiff = rawScores.some((s) => s !== rawScores[0]);
            const maxScore = Math.max(...rawScores);
            const bestIndices = scoreDiff
              ? rawScores
                  .map((s, i) => (s === maxScore ? i : -1))
                  .filter((i) => i !== -1)
              : [];

            return (
              <tr
                className={`clc-row${scoreDiff ? ' clc-row--diff' : ''}`}
                aria-label={diffAriaLabel(
                  'Risk Score',
                  rawScores.map(String),
                  lines,
                  bestIndices,
                )}
              >
                <th scope="row" className="clc-row-label">
                  Risk Score
                </th>
                {lines.map((l, idx) => {
                  const tag = COLUMN_TAGS[idx]?.toLowerCase() ?? String(idx);
                  const isWinner = scoreDiff && bestIndices.includes(idx);
                  const Icon = isWinner ? ArrowUpRight : ArrowDownRight;

                  return (
                    <td
                      key={`${l.id}-${idx}`}
                      className={`clc-cell clc-cell--${tag}${isWinner ? ' clc-cell--winner' : ''}`}
                    >
                      <span
                        className="clc-risk-score"
                        style={{ color: RISK_COLOR(l.riskScore) }}
                        aria-label={`Risk score ${l.riskScore}`}
                      >
                        {l.riskScore}
                      </span>
                      {scoreDiff && (
                        <span
                          className={`clc-diff-indicator clc-diff-indicator--${tag}`}
                          aria-hidden="true"
                          style={{
                            color: isWinner ? COLOR.success : COLOR.error,
                          }}
                        >
                          <Icon size={14} />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })()}

          {/* ── Upcoming Payments ── */}
          <tr className="clc-row-group-header">
            <td colSpan={lines.length + 1}>Upcoming Payments</td>
          </tr>

          {(() => {
            const row = buildTextRow(
              'Next Payment',
              (l) => (l.nextPaymentDate ? fmtDate(l.nextPaymentDate) : '—'),
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {(() => {
            const row = buildNumericRow(
              'Next Amount',
              (l) => l.nextPaymentAmount ?? 0,
              (val) => (val > 0 ? fmt(val) : '—'),
              false,
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {(() => {
            const row = buildTextRow(
              'Next Interest Accrual',
              (l) =>
                l.nextInterestAccrualDate
                  ? fmtDate(l.nextInterestAccrualDate)
                  : '—',
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {/* ── Activity ── */}
          <tr className="clc-row-group-header">
            <td colSpan={lines.length + 1}>Activity</td>
          </tr>

          {(() => {
            const row = buildTextRow(
              'Transactions',
              (l) => String(l.transactions.length),
            );
            return <GeneralizedCompareRow {...row} />;
          })()}

          {(() => {
            const row = buildTextRow(
              'Last Updated',
              (l) => fmtDate(l.updatedAt),
            );
            return <GeneralizedCompareRow {...row} />;
          })()}
        </tbody>
      </table>
    </div>
  );
}

// ─── Summary Scorecard ────────────────────────────────────────────────────────

/**
 * Summary scorecard underneath the table showing win counts across lines.
 */
function Scorecard({ lines }: { lines: CreditLine[] }) {
  const lineA = lines[0];
  const lineB = lines[1];

  // 6 quantitative metrics:
  // 1. Credit Limit (higher better)
  // 2. Utilized (lower better)
  // 3. Available (higher better)
  // 4. Utilization % (lower better)
  // 5. APR (lower better)
  // 6. Risk Score (higher better)
  const metricValues: { raw: number[]; higherBetter: boolean }[] = [
    { raw: lines.map((l) => l.limit), higherBetter: true },
    { raw: lines.map((l) => l.utilized), higherBetter: false },
    { raw: lines.map((l) => l.limit - l.utilized), higherBetter: true },
    {
      raw: lines.map((l) => utilizationPct(l.utilized, l.limit)),
      higherBetter: false,
    },
    { raw: lines.map((l) => l.apr), higherBetter: false },
    { raw: lines.map((l) => l.riskScore), higherBetter: true },
  ];

  const winsPerLine = new Array<number>(lines.length).fill(0);
  let totalTies = 0;

  for (const m of metricValues) {
    const isTie = m.raw.every((val) => val === m.raw[0]);
    if (isTie) {
      totalTies++;
    } else {
      const best = m.higherBetter ? Math.max(...m.raw) : Math.min(...m.raw);
      m.raw.forEach((val, i) => {
        if (val === best) {
          winsPerLine[i]++;
        }
      });
    }
  }

  return (
    <section className="clc-scorecard" aria-labelledby="clc-scorecard-heading">
      <h3 id="clc-scorecard-heading" className="clc-scorecard-heading">
        Metric Summary
      </h3>
      <p className="clc-scorecard-description">
        Across the six quantitative metrics above (limit, utilization, available,
        utilization %, APR, and risk score), here is how the lines compare:
      </p>

      <div className="clc-scorecard-grid" role="list">
        {lines.length === 2 ? (
          // 2-line exact layout preserving test expectations (A -> Ties -> B)
          <>
            <div
              className="clc-scorecard-item clc-scorecard-item--a"
              role="listitem"
            >
              <span className="clc-scorecard-tag" aria-hidden="true">
                A
              </span>
              <span className="clc-scorecard-label">{lineA.name}</span>
              <span
                className="clc-scorecard-wins"
                aria-label={`${lineA.name} wins ${winsPerLine[0]} of ${metricValues.length} metrics`}
              >
                {winsPerLine[0]} / {metricValues.length}
              </span>
            </div>
            <div
              className="clc-scorecard-item clc-scorecard-item--ties"
              role="listitem"
            >
              <span className="clc-scorecard-label">Ties</span>
              <span
                className="clc-scorecard-wins"
                aria-label={`${totalTies} metrics are equal`}
              >
                {totalTies}
              </span>
            </div>
            <div
              className="clc-scorecard-item clc-scorecard-item--b"
              role="listitem"
            >
              <span className="clc-scorecard-tag" aria-hidden="true">
                B
              </span>
              <span className="clc-scorecard-label">{lineB.name}</span>
              <span
                className="clc-scorecard-wins"
                aria-label={`${lineB.name} wins ${winsPerLine[1]} of ${metricValues.length} metrics`}
              >
                {winsPerLine[1]} / {metricValues.length}
              </span>
            </div>
          </>
        ) : (
          // N-lines layout (3 or 4 lines + Ties)
          <>
            {lines.map((line, idx) => {
              const tag = COLUMN_TAGS[idx]?.toLowerCase() ?? String(idx);
              return (
                <div
                  key={`${line.id}-${idx}`}
                  className={`clc-scorecard-item clc-scorecard-item--${tag}`}
                  role="listitem"
                >
                  <span className="clc-scorecard-tag" aria-hidden="true">
                    {COLUMN_TAGS[idx]}
                  </span>
                  <span className="clc-scorecard-label">{line.name}</span>
                  <span
                    className="clc-scorecard-wins"
                    aria-label={`${line.name} wins ${winsPerLine[idx]} of ${metricValues.length} metrics`}
                  >
                    {winsPerLine[idx]} / {metricValues.length}
                  </span>
                </div>
              );
            })}
            <div
              className="clc-scorecard-item clc-scorecard-item--ties"
              role="listitem"
            >
              <span className="clc-scorecard-label">Ties</span>
              <span
                className="clc-scorecard-wins"
                aria-label={`${totalTies} metrics are equal`}
              >
                {totalTies}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * CreditLineCompare — route: /compare-credit-lines
 *
 * Query params:
 *   ids — comma-separated IDs (e.g. ?ids=CL-1,CL-2,CL-3)
 *   a, b — legacy params (e.g. ?a=CL-1&b=CL-2)
 */
export default function CreditLineCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOverride, setPickerOverride] = useState(false);
  const { lines: allCreditLines } = useCreditLines();

  // Extract requested IDs from searchParams
  const idsParam = searchParams.get('ids');
  const legacyA = searchParams.get('a')?.trim();
  const legacyB = searchParams.get('b')?.trim();

  // Also check if invalid / unknown IDs were directly supplied in ?a=... or ?b=... or ?ids=...
  const requestedIdStrings = useMemo(() => {
    if (idsParam) {
      return idsParam.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const legacy = ['a', 'b', 'c', 'd']
      .map((k) => searchParams.get(k)?.trim())
      .filter((s): s is string => Boolean(s));
    return legacy;
  }, [idsParam, searchParams]);

  // Identify unknown IDs that were requested but do not exist in creditLines
  const unknownIds = useMemo(() => {
    return requestedIdStrings.filter(
      (id) => !allCreditLines.some((l) => l.id === id),
    );
  }, [requestedIdStrings, allCreditLines]);

  // Resolve valid CreditLine objects preserving selection order
  const resolvedLines = useMemo(() => {
    if (!idsParam && legacyA && legacyB) {
      const lineA = allCreditLines.find((l) => l.id === legacyA);
      const lineB = allCreditLines.find((l) => l.id === legacyB);
      if (lineA && lineB) {
        return [lineA, lineB];
      }
    }

    const rawIds = parseComparisonIdsFromSearchParams(searchParams);
    const list: CreditLine[] = [];
    for (const id of rawIds) {
      const match = allCreditLines.find((l) => l.id === id);
      if (match && !list.some((existing) => existing.id === match.id)) {
        list.push(match);
      }
    }
    return list;
  }, [idsParam, legacyA, legacyB, searchParams, allCreditLines]);

  const canCompare = resolvedLines.length >= 2;

  useEffect(() => {
    if (requestedIdStrings.length === 0) {
      setPickerOverride(false);
    }
  }, [requestedIdStrings.length]);

  /** Swap positions of first two lines or reverse all lines in the URL. */
  function handleSwap() {
    if (resolvedLines.length === 2) {
      const [first, second] = resolvedLines;
      setSearchParams(
        { a: second.id, b: first.id, ids: `${second.id},${first.id}` },
        { replace: true },
      );
    } else if (resolvedLines.length > 2) {
      const reversed = [...resolvedLines].reverse().map((l) => l.id);
      setSearchParams({ ids: reversed.join(',') }, { replace: true });
    }
    setPickerOverride(false);
  }

  /** Clear selection and return to picker. */
  function handleClear() {
    setSearchParams({}, { replace: true });
    setPickerOverride(true);
  }

  const isComparisonActive = canCompare && !pickerOverride;

  return (
    <main className="clc-page" aria-labelledby="clc-heading">
      {/* ── Page header ── */}
      <div className="clc-page-header">
        <Link
          to="/credit-lines"
          className="clc-back-link"
          aria-label="Back to Credit Lines list"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Credit Lines
        </Link>

        <div className="clc-heading-row">
          <h1 id="clc-heading" className="clc-heading">
            Compare Credit Lines
          </h1>

          {isComparisonActive && (
            <div className="clc-header-actions">
              <button
                type="button"
                className="clc-action-btn"
                onClick={handleSwap}
                aria-label={
                  resolvedLines.length === 2
                    ? 'Swap the positions of line A and line B'
                    : 'Reverse column order'
                }
              >
                ⇄ {resolvedLines.length === 2 ? 'Swap' : 'Reverse'}
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

        {isComparisonActive && (
          <p className="clc-heading-description">
            Comparing{' '}
            {resolvedLines.length === 2 ? (
              <>
                <strong
                  style={{
                    color: STATUS_COLOR[resolvedLines[0].status].color,
                  }}
                >
                  {resolvedLines[0].name}
                </strong>{' '}
                (A) with{' '}
                <strong
                  style={{
                    color: STATUS_COLOR[resolvedLines[1].status].color,
                  }}
                >
                  {resolvedLines[1].name}
                </strong>{' '}
                (B)
              </>
            ) : (
              resolvedLines.map((line, idx) => (
                <span key={line.id}>
                  {idx > 0 && idx === resolvedLines.length - 1
                    ? ' and '
                    : idx > 0
                      ? ', '
                      : ''}
                  <strong
                    style={{
                      color: STATUS_COLOR[line.status].color,
                    }}
                  >
                    {line.name}
                  </strong>{' '}
                  ({COLUMN_TAGS[idx]})
                </span>
              ))
            )}
            . Highlighted rows show where the lines differ.
          </p>
        )}
      </div>

      {/* ── Comparison Table or Picker ── */}
      {isComparisonActive ? (
        <>
          <CompareTable lines={resolvedLines} />
          <Scorecard lines={resolvedLines} />
        </>
      ) : (
        <>
          {/* Unknown / dropped IDs warning */}
          {unknownIds.length > 0 && (
            <div
              role="alert"
              className="clc-invalid-params"
              aria-live="polite"
            >
              {unknownIds.map((badId) => (
                <p key={badId}>
                  Credit line <code>{badId}</code> was not found.
                </p>
              ))}
            </div>
          )}

          <LinePicker
            lines={allCreditLines}
            initialSelected={resolvedLines.map((l) => l.id)}
          />
        </>
      )}
    </main>
  );
}
