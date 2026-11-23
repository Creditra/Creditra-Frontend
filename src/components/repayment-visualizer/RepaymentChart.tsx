import React, { useCallback, useId } from 'react';
import { COLOR } from '@/utils/tokens';
import { formatUsd } from '@/utils/currency';
import type { ScheduleRow, TooltipData } from './types';

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

export interface RepaymentChartProps {
  schedule: ScheduleRow[];
  tooltipId: string;
  onTooltip: (data: TooltipData | null) => void;
  tooltip: TooltipData | null;
  chartAriaLabel?: string;
  reducedMotion?: boolean;
}

export function RepaymentChart({
  schedule,
  tooltipId,
  onTooltip,
  tooltip,
  chartAriaLabel,
  reducedMotion = false,
}: RepaymentChartProps) {
  const chartPatternUid = useId().replace(/:/g, '');
  const gradPrincipalId = `rv-grad-principal-${chartPatternUid}`;
  const gradInterestId = `rv-grad-interest-${chartPatternUid}`;
  const hatchPrincipalId = `rv-principal-hatch-${chartPatternUid}`;
  const hatchInterestId = `rv-interest-hatch-${chartPatternUid}`;

  if (schedule.length === 0) return null;

  const initPrincipal = schedule[0].principal + schedule[0].principalPaid;
  const maxStack = initPrincipal + (schedule[schedule.length - 1]?.cumulativeInterest ?? 0);

  const xScale = useCallback(
    (i: number) => PAD.left + (i / (schedule.length - 1 || 1)) * CHART_W,
    [schedule.length],
  );
  const yScale = useCallback(
    (v: number) => PAD.top + CHART_H - (v / maxStack) * CHART_H,
    [maxStack],
  );

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
            x1={PAD.left}
            y1={y}
            x2={W - PAD.right}
            y2={y}
            stroke={COLOR.border}
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
          <text
            x={PAD.left - 6}
            y={y + 4}
            textAnchor="end"
            fontSize="10"
            fill={COLOR.muted}
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
        <text
          key={month}
          x={x}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill={COLOR.muted}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          mo {month}
        </text>
      ))}

      {/* Tooltip crosshair */}
      {tooltip && (
        <g>
          <line
            x1={tooltip.x}
            y1={PAD.top}
            x2={tooltip.x}
            y2={PAD.top + CHART_H}
            stroke={COLOR.border}
            strokeWidth="1"
          />
          <circle
            cx={tooltip.x}
            cy={yScale(tooltip.principal)}
            r="4"
            fill={COLOR.accent}
            stroke={COLOR.accent}
            strokeWidth="1.5"
            data-series="principal"
          />
          <circle
            cx={tooltip.x}
            cy={yScale(tooltip.principal + tooltip.cumulativeInterest)}
            r="4"
            fill={COLOR.warning}
            stroke={COLOR.warning}
            strokeWidth="1.5"
            strokeDasharray="2 2"
            data-series="interest"
          />
        </g>
      )}
    </svg>
  );
}

export function TooltipBubble({ data }: { data: TooltipData }) {
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
      <p style={{ fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-1)' }}>
        Month {data.month}
      </p>
      <p style={{ color: `var(--accent, ${COLOR.accent})` }}>
        Principal remaining: {formatUsd(data.principal, { decimals: 0 })}
      </p>
      <p style={{ color: `var(--warning, ${COLOR.warning})` }}>
        Cumulative interest: {formatUsd(data.cumulativeInterest, { decimals: 0 })}
      </p>
    </div>
  );
}
