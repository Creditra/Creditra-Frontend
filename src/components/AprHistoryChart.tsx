/**
 * AprHistoryChart
 *
 * Renders a 30 / 90 / 365-day APR history sparkline for a single credit
 * line. The chart is entirely SVG-based — no third-party charting library
 * is required — and consumes the design-token CSS custom properties that
 * every other Creditra component uses.
 *
 * Props
 * ─────
 * history   – Array of { date, apr } entries, sorted oldest→newest.
 *             Typically sourced from `CreditLine.aprHistory`.
 * lineId    – Stable ID used to scope aria labels and SVG clip-path ids.
 * label     – Optional accessible chart title (default: "APR History").
 *
 * Accessibility
 * ─────────────
 * • Window buttons expose role="group" + aria-label on the toolbar.
 * • The active window button is aria-pressed="true".
 * • The SVG has role="img" and an aria-labelledby pointing to a hidden
 *   <title> element that summarises the visible range.
 * • Keyboard-focusable data points expose tooltip values.
 * • A <table> data summary is rendered for screen-readers (sr-only).
 * • prefers-reduced-motion: area fill animation is suppressed.
 *
 * Theme Awareness
 * ───────────────
 * All colours are read from the CSS custom properties defined in
 * src/index.css so dark/high-contrast overrides work automatically.
 *
 * @module AprHistoryChart
 */

import { useMemo, useState, useId } from "react";
import type { AprHistoryEntry } from "../types/creditLine";
import {
  ChartFrame,
  ChartTooltip,
  ChartTooltipPoints,
  ChartDataTable,
  createLinearScale,
  buildPolylinePoints,
  buildAreaPath,
  useChartTooltip,
} from "./charts";
import type { ChartTooltipPoint } from "./charts";
import "./AprHistoryChart.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WindowDays = 30 | 90 | 365;

export interface AprHistoryChartProps {
  /** APR data points, sorted oldest→newest. */
  history: AprHistoryEntry[];
  /** Stable identifier for the credit line (used in aria / SVG ids). */
  lineId: string;
  /** Optional override for the accessible chart title. */
  label?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WINDOW_OPTIONS: { days: WindowDays; label: string }[] = [
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 365, label: "365D" },
];

/** Chart drawing area dimensions (unitless — SVG viewBox coords). */
const VB_W = 300;
const VB_H = 80;
/** Horizontal padding reserved for the first/last data-point dots. */
const PADDING_X = 4;
/** Vertical padding so lines/dots are never clipped at the edge. */
const PADDING_Y = 6;

const TABLE_COLUMNS = [{ header: "Date" }, { header: "APR (%)" }] as const;

// ─── Helper: filter history to the most-recent N days ────────────────────────

function filterWindow(
  history: AprHistoryEntry[],
  days: WindowDays,
): AprHistoryEntry[] {
  if (history.length === 0) return [];

  const latestEntry = history[history.length - 1];
  const cutoff = new Date(latestEntry.date);
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = history.filter((entry) => new Date(entry.date) >= cutoff);

  // Guarantee at least 2 points so the SVG path can be drawn.
  // For shorter histories, show everything we have instead of hiding data.
  return filtered.length >= 2
    ? filtered
    : history.slice(-Math.min(history.length, 2));
}

// ─── Helper: project data to SVG coordinates ─────────────────────────────────

interface Point {
  x: number;
  y: number;
  entry: AprHistoryEntry;
}

function projectPoints(entries: AprHistoryEntry[]): {
  points: Point[];
  minApr: number;
  maxApr: number;
} {
  if (entries.length === 0) {
    return { points: [], minApr: 0, maxApr: 0 };
  }

  const aprs = entries.map((e) => e.apr);
  let minApr = Math.min(...aprs);
  let maxApr = Math.max(...aprs);

  // Ensure a minimum visible range so a flat line appears centred
  if (maxApr - minApr < 0.1) {
    const mid = (minApr + maxApr) / 2;
    minApr = mid - 0.05;
    maxApr = mid + 0.05;
  }

  const xScale = createLinearScale(
    [0, Math.max(entries.length - 1, 1)],
    [PADDING_X, VB_W - PADDING_X],
  );
  const yScale = createLinearScale(
    [minApr, maxApr],
    [VB_H - PADDING_Y, PADDING_Y],
  );

  const points: Point[] = entries.map((entry, i) => ({
    x: xScale(i),
    y: yScale(entry.apr),
    entry,
  }));

  return { points, minApr, maxApr };
}

// ─── Helper: format dates for tooltips / aria ────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Sparkline chart showing APR history for a single credit line.
 * Renders a window-selector toolbar (30D / 90D / 1Y) and an SVG line
 * chart with a filled area and endpoint annotation dots.
 */
export function AprHistoryChart({
  history,
  lineId,
  label = "APR History",
}: AprHistoryChartProps) {
  const [window, setWindow] = useState<WindowDays>(90);
  const uniqueId = useId().replace(/:/g, "");
  const sanitizedLineId = lineId.replace(/[^a-z0-9]/gi, "");
  const clipId = `apr-clip-${sanitizedLineId}-${uniqueId}`;
  const gradientId = `apr-grad-${sanitizedLineId}-${uniqueId}`;

  const visible = useMemo(
    () => filterWindow(history, window),
    [history, window],
  );
  const { points, minApr, maxApr } = useMemo(
    () => projectPoints(visible),
    [visible],
  );

  const isEmpty = points.length < 2;

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  // Determine trend colour: green = falling APR (good), red = rising APR (bad)
  const trendColor =
    isEmpty || lastPoint.entry.apr <= firstPoint.entry.apr
      ? "var(--success, #3fb950)"
      : "var(--error, #f85149)";

  const polylinePoints = isEmpty ? "" : buildPolylinePoints(points);
  const areaPath = isEmpty ? "" : buildAreaPath(points, VB_H - PADDING_Y);

  const tooltipPoints: ChartTooltipPoint[] = useMemo(
    () =>
      isEmpty
        ? []
        : points.map((p) => ({
            key: p.entry.date,
            x: p.x,
            y: p.y,
            label: fmtDate(p.entry.date),
            value: `${p.entry.apr.toFixed(2)}%`,
          })),
    [isEmpty, points],
  );

  const { activeIndex, setActiveIndex, activePoint } =
    useChartTooltip(tooltipPoints);

  const summaryText = isEmpty
    ? `No ${label} data`
    : `${label} from ${fmtDate(firstPoint.entry.date)} to ${fmtDate(lastPoint.entry.date)}, ` +
      `range ${minApr.toFixed(2)}%–${maxApr.toFixed(2)}%`;

  const tableRows = useMemo(
    () =>
      visible.map((entry) => ({
        key: entry.date,
        cells: [fmtDate(entry.date), entry.apr.toFixed(2)],
      })),
    [visible],
  );

  return (
    <div className="apr-history-chart" data-testid="apr-history-chart">
      {/* ── Window selector toolbar ── */}
      <div
        className="apr-history-chart__toolbar"
        role="group"
        aria-label="APR history time window"
      >
        <span className="apr-history-chart__title">{label}</span>
        <div className="apr-history-chart__windows">
          {WINDOW_OPTIONS.map(({ days, label: btnLabel }) => (
            <button
              key={days}
              type="button"
              className={`apr-history-chart__window-btn${window === days ? " active" : ""}`}
              aria-pressed={window === days}
              onClick={() => setWindow(days)}
            >
              {btnLabel}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG chart ── */}
      <div className="chart-frame-wrapper">
        <ChartFrame
          width={VB_W}
          height={VB_H}
          title={summaryText}
          preserveAspectRatio="none"
          className="apr-history-chart__svg"
        >
          <defs>
            {/* Gradient fill below the line */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={trendColor} stopOpacity="0.22" />
              <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
            </linearGradient>
            {/* Clip to drawing area so dots/lines are never clipped at edges */}
            <clipPath id={clipId}>
              <rect x="0" y="0" width={VB_W} height={VB_H} />
            </clipPath>
          </defs>

          {isEmpty ? (
            // Empty state: render a subtle dashed centre line
            <line
              x1={PADDING_X}
              y1={VB_H / 2}
              x2={VB_W - PADDING_X}
              y2={VB_H / 2}
              stroke="var(--border, #30363d)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ) : (
            <g clipPath={`url(#${clipId})`} className="apr-history-chart__series">
              {/* Filled area */}
              <path
                className="apr-history-chart__area"
                d={areaPath}
                fill={`url(#${gradientId})`}
              />
              {/* Line */}
              <polyline
                className="apr-history-chart__line"
                points={polylinePoints}
                fill="none"
                stroke={trendColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* First-point dot */}
              <circle
                cx={firstPoint.x}
                cy={firstPoint.y}
                r="2.5"
                fill={trendColor}
                opacity="0.7"
                aria-hidden="true"
              />
              {/* Last-point dot (current APR) */}
              <circle
                cx={lastPoint.x}
                cy={lastPoint.y}
                r="3"
                fill={trendColor}
                aria-hidden="true"
              />
              <ChartTooltipPoints
                points={tooltipPoints}
                activeIndex={activeIndex}
                onActiveChange={setActiveIndex}
              />
            </g>
          )}
        </ChartFrame>
        <ChartTooltip point={activePoint} />
      </div>

      {/* ── Axis labels ── */}
      {!isEmpty ? (
        <div className="apr-history-chart__axis" aria-hidden="true">
          <span className="apr-history-chart__axis-label">
            {fmtDate(firstPoint.entry.date)}
          </span>
          <span
            className="apr-history-chart__axis-value"
            style={{ color: trendColor }}
          >
            {lastPoint.entry.apr.toFixed(2)}%
          </span>
          <span className="apr-history-chart__axis-label">
            {fmtDate(lastPoint.entry.date)}
          </span>
        </div>
      ) : (
        <p className="apr-history-chart__empty-copy" aria-live="polite">
          No APR history available yet.
        </p>
      )}

      {/* ── Screen-reader data table (visually hidden) ── */}
      <ChartDataTable
        ariaLabel={`${label} data table`}
        caption={summaryText}
        columns={TABLE_COLUMNS}
        rows={tableRows}
      />
    </div>
  );
}
