/**
 * RepaymentVisualizer
 *
 * Renders a stacked area chart (principal vs interest) for a repayment schedule,
 * with an accessible SR-fallback data table, hover/long-press tooltip, and keyboard navigation.
 *
 * Approach:
 *  - Pure SVG — no third-party charting library.
 *  - Theme tokens from CSS custom properties; colours from src/utils/tokens.ts.
 *  - WCAG 2.1 AA: focus ring, aria-label, role="img", table fallback,
 *    keyboard navigation (Arrow keys / Home / End / Esc), KbdHint hints,
 *    reduced-motion support.
 *
 * Animation & reduced-motion
 * ──────────────────────────
 * By default the chart area paths animate in with a "grow upward" effect
 * (see RepaymentVisualizer.css). When either of the following is true the
 * animation is suppressed and areas are displayed statically:
 *
 *   1. The OS/browser `prefers-reduced-motion: reduce` media query is active.
 *   2. The in-app reduced-motion override is enabled via `ReducedMotionContext`
 *      (Settings → Accessibility → Reduced Motion Preview).
 *
 * The chart wrapper receives `data-reduced-motion="true"` so the CSS can target
 * it without needing JS class manipulation on every child element.
 */

import React, { useState, useRef, useCallback, useId, useMemo, useEffect } from 'react';
import { COLOR } from '@/utils/tokens';
import { KbdHint } from './KbdHint';
import { LiveRegion } from './LiveRegion';
import { useReducedMotion } from '@/context/ReducedMotionContext';
import { EmptyState } from './EmptyState';
import { NoDataGraph } from './illustrations';
import { Skeleton } from './Skeleton';
import './RepaymentVisualizer.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  /** 1-based month number */
  month: number;
  /** Remaining principal at end of month */
  principal: number;
  /** Cumulative interest paid to end of month */
  cumulativeInterest: number;
  /** Interest component of this month's payment */
  interest: number;
  /** Principal component of this month's payment */
  principalPaid: number;
}

export interface RepaymentVisualizerProps {
  /** Outstanding debt at start */
  principal: number;
  /** Annual percentage rate (e.g. 8.5 for 8.5 %) */
  apr: number;
  /** Fixed monthly payment */
  monthlyPayment: number;
  /** Max months to project (capped at 360) */
  maxMonths?: number;
  /**
   * Override the default `aria-label` on the SVG chart element.
   *
   * Defaults to: "Stacked area chart showing principal and cumulative interest
   * over repayment months".  Supply a more specific label when the chart is
   * embedded in a context where extra detail is useful — e.g. including the
   * loan amount or product name.
   *
   * Example: "Repayment chart for $50,000 home-improvement loan at 7.25% APR"
   */
  chartAriaLabel?: string;
  /**
   * Plain-text caption appended to the SR-only data table's `<caption>`
   * element.  When omitted the caption is generated automatically from
   * `termMonths` and `totalInterest`.
   *
   * Use this prop to provide additional context that the automatic summary
   * cannot derive — e.g. the loan product name or a custom note.
   *
   * Example: "Home improvement loan — 48 months · $4,230 total interest"
   */
  caption?: string;
  /**
   * Loading / first-paint control (FWC26 / issue #609).
   *
   * - `true`  — always show the themed skeleton
   * - `false` — skip the first-paint skeleton (useful in unit tests)
   * - omitted — show a one-frame first-paint skeleton via `setTimeout(0)` so
   *   the chart layout does not pop in before the browser paints placeholders
   */
  loading?: boolean;
}

// ─── Schedule generator ────────────────────────────────────────────────────────

function buildSchedule(
  principal: number,
  apr: number,
  monthlyPayment: number,
  maxMonths: number,
): ScheduleRow[] {
  if (principal <= 0 || monthlyPayment <= 0) return [];

  const monthlyRate = apr / 100 / 12;
  let remaining = principal;
  let cumInterest = 0;
  const rows: ScheduleRow[] = [];

  for (let m = 1; m <= maxMonths && remaining > 0; m++) {
    const interest = remaining * monthlyRate;
    const principalPaid = Math.min(monthlyPayment - interest, remaining);
    cumInterest += interest;
    remaining = Math.max(0, remaining - principalPaid);

    rows.push({
      month: m,
      principal: remaining,
      cumulativeInterest: cumInterest,
      interest,
      principalPaid: Math.max(0, principalPaid),
    });

    if (remaining <= 0) break;
  }

  return rows;
}

// ─── SVG chart ────────────────────────────────────────────────────────────────

const W = 600;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 36, left: 56 };
const CHART_W = W - PAD.left - PAD.right;
const CHART_H = H - PAD.top - PAD.bottom;

function toPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

interface TooltipData {
  month: number;
  principal: number;
  cumulativeInterest: number;
  x: number;
  y: number;
}

interface ChartProps {
  schedule: ScheduleRow[];
  tooltipId: string;
  onTooltip: (data: TooltipData | null) => void;
  tooltip: TooltipData | null;
  /** Optional override for the SVG aria-label (from RepaymentVisualizerProps). */
  chartAriaLabel?: string;
  /**
   * When true the chart area paths are rendered statically — no CSS animation
   * is applied. Set by the parent based on `isReducedMotionActive` from
   * `ReducedMotionContext` (which also responds to the OS media query).
   */
  reducedMotion?: boolean;
}

function StackedAreaChart({ schedule, tooltipId, onTooltip, tooltip, chartAriaLabel, reducedMotion = false }: ChartProps) {
  const chartPatternUid = useId().replace(/:/g, '');
  const gradPrincipalId = `rv-grad-principal-${chartPatternUid}`;
  const gradInterestId = `rv-grad-interest-${chartPatternUid}`;
  const hatchPrincipalId = `rv-principal-hatch-${chartPatternUid}`;
  const hatchInterestId = `rv-interest-hatch-${chartPatternUid}`;

  if (schedule.length === 0) return null;

  const initPrincipal = schedule[0].principal + schedule[0].principalPaid;
  const maxStack = initPrincipal + (schedule[schedule.length - 1]?.cumulativeInterest ?? 0);

  const xScale = useCallback((i: number) => PAD.left + (i / (schedule.length - 1 || 1)) * CHART_W, [schedule.length]);
  const yScale = useCallback((v: number) => PAD.top + CHART_H - (v / maxStack) * CHART_H, [maxStack]);

  // Area 1: principal remaining (bottom area)
  const principalTop: [number, number][] = schedule.map((r, i) => [xScale(i), yScale(r.principal)]);
  const principalBase: [number, number][] = [
    [xScale(schedule.length - 1), yScale(0)],
    [xScale(0), yScale(0)],
  ];
  const principalPath = `${toPath(principalTop)} ${toPath(principalBase)} Z`;

  // Area 2: cumulative interest (stacked on top of principal)
  const interestTop: [number, number][] = schedule.map((r, i) => [
    xScale(i),
    yScale(r.principal + r.cumulativeInterest),
  ]);
  const interestBase: [number, number][] = [...principalTop].reverse();
  const interestPath = `${toPath(interestTop)} ${toPath(interestBase)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: maxStack * f,
    y: yScale(maxStack * f),
  }));

  // X-axis ticks (up to 6)
  const xTickCount = Math.min(schedule.length, 6);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => {
    const idx = Math.round((i / (xTickCount - 1 || 1)) * (schedule.length - 1));
    return { month: schedule[idx].month, x: xScale(idx) };
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const relX = svgX - PAD.left;
      const idx = Math.round((relX / CHART_W) * (schedule.length - 1));
      const clamped = Math.max(0, Math.min(idx, schedule.length - 1));
      const row = schedule[clamped];
      onTooltip({
        month: row.month,
        principal: row.principal,
        cumulativeInterest: row.cumulativeInterest,
        x: xScale(clamped),
        y: yScale(row.principal + row.cumulativeInterest),
      });
    },
    [schedule, xScale, yScale, onTooltip],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (schedule.length === 0) return;
      const currentIdx = tooltip ? schedule.findIndex((r) => r.month === tooltip.month) : -1;

      let nextIdx = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = currentIdx < 0 ? 0 : Math.min(schedule.length - 1, currentIdx + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = currentIdx < 0 ? 0 : Math.max(0, currentIdx - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = schedule.length - 1;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onTooltip(null);
        return;
      }

      if (nextIdx >= 0 && nextIdx < schedule.length) {
        const row = schedule[nextIdx];
        onTooltip({
          month: row.month,
          principal: row.principal,
          cumulativeInterest: row.cumulativeInterest,
          x: xScale(nextIdx),
          y: yScale(row.principal + row.cumulativeInterest),
        });
      }
    },
    [schedule, tooltip, xScale, yScale, onTooltip],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      tabIndex={0}
      aria-label={
        chartAriaLabel ??
        'Stacked area chart showing principal and cumulative interest over repayment months'
      }
      aria-describedby={tooltipId}
      aria-valuenow={tooltip ? tooltip.month : undefined}
      aria-valuemin={schedule.length > 0 ? 1 : undefined}
      aria-valuemax={schedule.length > 0 ? schedule[schedule.length - 1].month : undefined}
      aria-valuetext={
        tooltip
          ? `Month ${tooltip.month}: Principal remaining $${Math.round(tooltip.principal)}, cumulative interest $${Math.round(tooltip.cumulativeInterest)}`
          : undefined
      }
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      className="repayment-visualizer-focus"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onTooltip(null)}
      onTouchEnd={() => onTooltip(null)}
      onKeyDown={handleKeyDown}
    >
      <defs>
        <linearGradient id={gradPrincipalId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLOR.accent} stopOpacity="0.7" />
          <stop offset="100%" stopColor={COLOR.accent} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={gradInterestId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLOR.warning} stopOpacity="0.7" />
          <stop offset="100%" stopColor={COLOR.warning} stopOpacity="0.15" />
        </linearGradient>
        <pattern
          id={hatchPrincipalId}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={COLOR.accent} strokeWidth="1.25" strokeOpacity="0.75" />
        </pattern>
        <pattern
          id={hatchInterestId}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(135)"
        >
          <rect width="6" height="6" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={COLOR.warning} strokeWidth="1.25" strokeOpacity="0.75" />
        </pattern>
      </defs>

      {/* Grid lines */}
      {yTicks.map(({ y, value }) => (
        <g key={value}>
          <line
            x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke={COLOR.border} strokeWidth="0.5" strokeDasharray="4 4"
          />
          <text
            x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill={COLOR.muted}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtK(value)}
          </text>
        </g>
      ))}

      {/* Interest area — painted first (sits below principal visually) */}
      <path
        d={interestPath}
        fill={`url(#${gradInterestId})`}
        data-series="interest"
        className={`rv-area rv-area--interest${reducedMotion ? '' : ' rv-area-animate rv-area-animate--interest'}`}
      />
      <path
        d={interestPath}
        fill={`url(#${hatchInterestId})`}
        opacity={0.42}
        aria-hidden="true"
        data-series="interest"
        className="rv-area-hatch rv-area-hatch--interest"
      />
      {/* Principal area */}
      <path
        d={principalPath}
        fill={`url(#${gradPrincipalId})`}
        data-series="principal"
        className={`rv-area rv-area--principal${reducedMotion ? '' : ' rv-area-animate'}`}
      />
      <path
        d={principalPath}
        fill={`url(#${hatchPrincipalId})`}
        opacity={0.42}
        aria-hidden="true"
        data-series="principal"
        className="rv-area-hatch rv-area-hatch--principal"
      />

      {/* X-axis ticks */}
      {xTicks.map(({ month, x }) => (
        <text key={month} x={x} y={H - 6} textAnchor="middle" fontSize="10" fill={COLOR.muted}
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          mo {month}
        </text>
      ))}

      {/* Tooltip crosshair */}
      {tooltip && (
        <g>
          <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + CHART_H}
            stroke={COLOR.border} strokeWidth="1" />
          <circle cx={tooltip.x} cy={yScale(tooltip.principal)} r="4"
            fill={COLOR.accent} stroke={COLOR.accent} strokeWidth="1.5" data-series="principal" />
          <circle cx={tooltip.x} cy={yScale(tooltip.principal + tooltip.cumulativeInterest)} r="4"
            fill={COLOR.warning} stroke={COLOR.warning} strokeWidth="1.5" strokeDasharray="2 2"
            data-series="interest" />
        </g>
      )}
    </svg>
  );
}

// ─── Tooltip bubble ────────────────────────────────────────────────────────────

function TooltipBubble({ data }: { data: TooltipData }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div
      className="p-2 sm:p-3 text-xs min-w-[140px] sm:min-w-[160px]"
      style={{
        background: 'var(--surface-raised, #1c2230)',
        border: `1px solid var(--border, ${COLOR.border})`,
        borderRadius: 'var(--radius-md)',
        color: `var(--text, ${COLOR.text})`,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <p style={{ fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-1)' }}>Month {data.month}</p>
      <p style={{ color: `var(--accent, ${COLOR.accent})` }}>
        Principal remaining: {fmt(data.principal)}
      </p>
      <p style={{ color: `var(--warning, ${COLOR.warning})` }}>
        Cumulative interest: {fmt(data.cumulativeInterest)}
      </p>
    </div>
  );
}

// ─── SR table fallback ─────────────────────────────────────────────────────────

interface SRTableProps {
  schedule: ScheduleRow[];
  caption?: string;
}

function SRTable({ schedule, caption }: SRTableProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  const fmtShort = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const termMonths = schedule.length;
  const totalInterest = schedule[schedule.length - 1]?.cumulativeInterest ?? 0;
  const resolvedCaption =
    caption ??
    `Monthly repayment schedule: ${termMonths} month${termMonths !== 1 ? 's' : ''}, ${fmtShort(totalInterest)} total interest`;

  return (
    <table
      className="sr-only tabular-nums"
      aria-label="Repayment schedule data table"
      style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--text-xs)' }}
    >
      <caption className="sr-only">{resolvedCaption}</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Principal Paid</th>
          <th scope="col">Interest Paid</th>
          <th scope="col">Remaining Principal</th>
          <th scope="col">Cumulative Interest</th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((row) => (
          <tr key={row.month}>
            <td>{row.month}</td>
            <td>{fmt(row.principalPaid)}</td>
            <td>{fmt(row.interest)}</td>
            <td>{fmt(row.principal)}</td>
            <td>{fmt(row.cumulativeInterest)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 sm:gap-4 text-xs${reducedMotion ? '' : ' rv-legend-animate'}`}
      style={{ color: `var(--muted, ${COLOR.muted})` }}
      aria-hidden="true"
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="rv-legend-swatch rv-legend-swatch--principal" data-series="principal" />
        Principal remaining
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span className="rv-legend-swatch rv-legend-swatch--interest" data-series="interest" />
        Cumulative interest
      </span>
    </div>
  );
}

// ─── Visible fallback table (non-SR) ──────────────────────────────────────────

interface VisibleTableProps {
  schedule: ScheduleRow[];
  limit?: number;
}

function VisibleTable({ schedule, limit = 12 }: VisibleTableProps) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? schedule : schedule.slice(0, limit);
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  const thStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: 'var(--space-2)',
    fontWeight: 'var(--font-semibold)',
    fontSize: 'var(--text-xs)',
    color: `var(--muted, ${COLOR.muted})`,
    borderBottom: `1px solid var(--border, ${COLOR.border})`,
    whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    textAlign: 'right',
    padding: 'var(--space-1) var(--space-2)',
    fontSize: 'var(--text-xs)',
    color: `var(--text, ${COLOR.text})`,
    fontVariantNumeric: 'tabular-nums',
  };

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
      <table
        aria-label="Repayment schedule"
        className="tabular-nums"
        style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}
      >
        <thead>
          <tr>
            <th scope="col" style={{ ...thStyle, textAlign: 'left' }}>Month</th>
            <th scope="col" style={thStyle}>Principal Paid</th>
            <th scope="col" style={thStyle}>Interest</th>
            <th scope="col" style={thStyle}>Remaining</th>
            <th scope="col" style={thStyle}>Cum. Interest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.month}
              style={{ background: i % 2 === 0 ? 'transparent' : `var(--surface, ${COLOR.surface})` }}
            >
              <td style={{ ...tdStyle, textAlign: 'left', color: `var(--muted, ${COLOR.muted})` }}>
                {row.month}
              </td>
              <td style={{ ...tdStyle, color: `var(--accent, ${COLOR.accent})` }}>
                {fmt(row.principalPaid)}
              </td>
              <td style={{ ...tdStyle, color: `var(--warning, ${COLOR.warning})` }}>
                {fmt(row.interest)}
              </td>
              <td style={tdStyle}>{fmt(row.principal)}</td>
              <td style={tdStyle}>{fmt(row.cumulativeInterest)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {schedule.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="repayment-visualizer-focus"
          style={{
            marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: `var(--accent, ${COLOR.accent})`,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 'var(--space-1) 0',
          }}
          aria-expanded={showAll}
        >
          {showAll ? 'Show fewer rows' : `Show all ${schedule.length} months`}
        </button>
      )}
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyStatePrompt() {
  return (
    <EmptyState
      data-testid="repayment-visualizer-empty"
      illustration={<NoDataGraph />}
      eyebrow="Repayment Plan"
      title="No repayment data yet"
      description="Enter a valid principal, APR, and monthly payment to see your projected repayment plan, including monthly breakdowns and interest calculations."
    />
  );
}

// ─── First-paint skeleton (FWC26 / issue #609) ─────────────────────────────────

/**
 * Themed shimmer matching the final RepaymentVisualizer card geometry so
 * first paint does not jump when the schedule chart commits (CLS ≈ 0).
 *
 * Shape parity:
 *  - Card shell uses `--surface` / `--border` / `--radius-lg`
 *  - Chart placeholder height matches the SVG viewBox height (`H = 220`)
 *  - Header / meta / legend rows mirror the loaded layout spacing
 */
export function RepaymentVisualizerSkeleton() {
  return (
    <section
      className="p-4 sm:p-5 md:p-6 rv-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading repayment plan visualizer"
      data-testid="repayment-visualizer-skeleton"
      style={{
        background: `var(--surface, ${COLOR.surface})`,
        border: `1px solid var(--border, ${COLOR.border})`,
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div aria-hidden="true" className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <Skeleton width={140} height={20} shape="rounded" />
        <Skeleton width={160} height={14} shape="rounded" />
      </div>
      <Skeleton
        width="100%"
        height={220}
        shape="rounded"
        className="rv-skeleton__chart"
        aria-hidden={true}
      />
      <div aria-hidden="true" className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-3">
        <Skeleton width={180} height={12} shape="rounded" />
        <Skeleton width={120} height={12} shape="rounded" />
      </div>
      <Skeleton width={110} height={14} shape="rounded" className="mt-4" aria-hidden={true} />
    </section>
  );
}

// ─── SR live-region message builder ──────────────────────────────────────────

/** Formatter shared by liveMessage and tooltip caption. */
const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/**
 * Builds the plain-text message for the polite `aria-live` region.
 *
 * - Empty schedule → empty string (nothing to announce).
 * - Active tooltip → month-specific principal + interest breakdown.
 * - Normal state   → plan summary (term + total interest).
 */
function buildLiveMessage(
  schedule: ScheduleRow[],
  tooltip: TooltipData | null,
  termMonths: number,
  totalInterest: number,
): string {
  if (schedule.length === 0) return '';

  if (tooltip) {
    return `Month ${tooltip.month}: principal remaining ${usdFmt.format(tooltip.principal)}, cumulative interest ${usdFmt.format(tooltip.cumulativeInterest)}.`;
  }

  return `Repayment plan: ${termMonths} month${termMonths !== 1 ? 's' : ''}, ${usdFmt.format(totalInterest)} total interest.`;
}

// ─── Main component ────────────────────────────────────────────────────────────

/**
 * RepaymentVisualizer displays a stacked area chart (principal vs cumulative
 * interest) over the life of a loan, plus an accessible data table and
 * keyboard shortcut hints.
 *
 * Accessibility props
 * ───────────────────
 * `chartAriaLabel` — overrides the default `aria-label` on the SVG element.
 * `caption` — overrides the auto-generated `<caption>` in the SR-only table.
 *
 * Loading / first paint (FWC26 / issue #609)
 * ──────────────────────────────────────────
 * When `loading` is omitted, a one-frame themed skeleton paints first so the
 * chart does not pop in. Pass `loading={false}` to skip that gate (tests).
 *
 * Reduced-motion
 * ──────────────
 * Reads `isReducedMotionActive` from `ReducedMotionContext`. When true, CSS
 * animation classes are omitted and `data-reduced-motion="true"` is set on
 * the chart wrapper so the CSS fallback rules take effect.
 */
export function RepaymentVisualizer({
  principal,
  apr,
  monthlyPayment,
  maxMonths = 360,
  chartAriaLabel,
  caption,
  loading,
}: RepaymentVisualizerProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const tooltipId = useId();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => loading !== false);

  // First-paint / controlled loading gate — yields one frame for the skeleton.
  useEffect(() => {
    if (loading === true) {
      setBootstrapping(true);
      return;
    }
    if (loading === false) {
      setBootstrapping(false);
      return;
    }
    const id = setTimeout(() => setBootstrapping(false), 0);
    return () => clearTimeout(id);
  }, [loading, principal, apr, monthlyPayment]);

  // Detect reduced-motion preference from OS or in-app override.
  // When true, the chart renders statically (no CSS animations).
  const { isReducedMotionActive } = useReducedMotion();

  const schedule = useMemo(
    () => buildSchedule(principal, apr, monthlyPayment, maxMonths),
    [principal, apr, monthlyPayment, maxMonths],
  );

  // Long-press for mobile tooltip
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      longPressTimer.current = setTimeout(() => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const relX = touch.clientX - rect.left;
        const idx = Math.round((relX / rect.width) * (schedule.length - 1));
        const clamped = Math.max(0, Math.min(idx, schedule.length - 1));
        const row = schedule[clamped];
        if (row) {
          setTooltip({
            month: row.month,
            principal: row.principal,
            cumulativeInterest: row.cumulativeInterest,
            x: 0,
            y: 0,
          });
        }
      }, 400);
    },
    [schedule],
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const totalInterest = schedule[schedule.length - 1]?.cumulativeInterest ?? 0;
  const termMonths = schedule.length;

  // ── ARIA live-region announcement ──
  const liveMessage = useMemo(() => {
    return buildLiveMessage(schedule, tooltip, termMonths, totalInterest);
  }, [schedule, tooltip, termMonths, totalInterest]);

  if (loading === true || bootstrapping) {
    return <RepaymentVisualizerSkeleton />;
  }

  return (
    <section
      aria-label="Repayment plan visualizer"
      className="p-4 sm:p-5 md:p-6"
      style={{
        background: `var(--surface, ${COLOR.surface})`,
        border: `1px solid var(--border, ${COLOR.border})`,
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Announce state changes (schedule calc, month inspection) to screen readers */}
      <LiveRegion message={liveMessage} politeness="polite" />

      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: `var(--text, ${COLOR.text})`, margin: 0 }}
          >
            Repayment Plan
          </h2>
          {schedule.length > 0 && (
            <KbdHint
              keys={['←', '→']}
              label="Inspect month"
              variant="badge"
              aria-label="Keyboard shortcut: Left and Right arrow keys to inspect month"
            />
          )}
        </div>
        {schedule.length > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: `var(--muted, ${COLOR.muted})`, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {termMonths} month{termMonths !== 1 ? 's' : ''} ·{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(totalInterest)}{' '}
            total interest
          </p>
        )}
      </header>

      {schedule.length === 0 ? (
        <EmptyStatePrompt />
      ) : (
        <>
          {/* Chart wrapper — carries data-reduced-motion for CSS targeting */}
          <div
            className="rv-chart-wrap"
            style={{ position: 'relative' }}
            data-reduced-motion={isReducedMotionActive ? 'true' : undefined}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <StackedAreaChart
              schedule={schedule}
              tooltipId={tooltipId}
              onTooltip={setTooltip}
              tooltip={tooltip}
              chartAriaLabel={chartAriaLabel}
              reducedMotion={isReducedMotionActive}
            />

            {/* Tooltip bubble — positioned absolutely over chart */}
            {tooltip && (
              <div id={tooltipId} style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}>
                <TooltipBubble data={tooltip} />
              </div>
            )}
          </div>

          {/* Legend row with keyboard shortcut hints */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3 sm:mt-4">
            <Legend reducedMotion={isReducedMotionActive} />
            <div className="flex items-center gap-2 text-xs">
              <KbdHint keys={['←', '→']} label="Inspect" />
              <KbdHint keys="Esc" label="Clear" />
            </div>
          </div>

          {/* SR-only full data table (always present for assistive tech) */}
          <SRTable schedule={schedule} caption={caption} />

          {/* Visible table */}
          <details style={{ marginTop: 'var(--space-4)' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 'var(--text-xs)',
                color: `var(--accent, ${COLOR.accent})`,
                userSelect: 'none',
                padding: 'var(--space-1) 0',
              }}
              className="repayment-visualizer-focus"
            >
              Schedule table
            </summary>
            <div style={{ marginTop: 'var(--space-2)' }}>
              <VisibleTable schedule={schedule} />
            </div>
          </details>
        </>
      )}
    </section>
  );
}

export default RepaymentVisualizer;
