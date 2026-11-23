/**
 * RepaymentVisualizer
 *
 * Renders a stacked area chart (principal vs interest) for a repayment schedule,
 * with an accessible SR-fallback data table, hover/long-press tooltip, and keyboard navigation.
 */

import React, { useState, useRef, useCallback, useId, useMemo, useEffect } from 'react';
import { COLOR } from '@/utils/tokens';
import { getNumberFormat } from '@/utils/formatters';
import { formatUsd } from '@/utils/currency';
import { KbdHint } from './KbdHint';
import { LiveRegion } from './LiveRegion';
import { useReducedMotion } from '@/context/ReducedMotionContext';
import { EmptyState } from './EmptyState';
import { NoDataGraph } from './illustrations';
import { Skeleton } from './Skeleton';
import { RepaymentChart, TooltipBubble } from './repayment-visualizer/RepaymentChart';
import { RepaymentLegend } from './repayment-visualizer/RepaymentLegend';
import { ScenarioControls } from './repayment-visualizer/ScenarioControls';
import {
  buildSchedule,
  type ScheduleRow,
  type TooltipData,
} from './repayment-visualizer/types';
import './RepaymentVisualizer.css';

export type { ScheduleRow } from './repayment-visualizer/types';

export interface RepaymentVisualizerProps {
  /** Outstanding debt at start */
  principal: number;
  /** Annual percentage rate (e.g. 8.5 for 8.5 %) */
  apr: number;
  /** Fixed monthly payment */
  monthlyPayment: number;
  /** Max months to project (capped at 360) */
  maxMonths?: number;
  /** Override the default `aria-label` on the SVG chart element. */
  chartAriaLabel?: string;
  /** Plain-text caption appended to the SR-only data table's `<caption>`. */
  caption?: string;
  /**
   * Loading / first-paint control (FWC26 / issue #609).
   * - `true`  — always show the themed skeleton
   * - `false` — skip the first-paint skeleton (useful in unit tests)
   * - omitted — show a one-frame first-paint skeleton via `setTimeout(0)`
   */
  loading?: boolean;
}

    getNumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    getNumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
    getNumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    getNumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
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

function buildLiveMessage(
  schedule: ScheduleRow[],
  tooltip: TooltipData | null,
  termMonths: number,
  totalInterest: number,
): string {
  if (schedule.length === 0) return '';

  if (tooltip) {
    return `Month ${tooltip.month}: principal remaining ${formatUsd(tooltip.principal, { decimals: 0 })}, cumulative interest ${formatUsd(tooltip.cumulativeInterest, { decimals: 0 })}.`;
  }

  return `Repayment plan: ${termMonths} month${termMonths !== 1 ? 's' : ''}, ${formatUsd(totalInterest, { decimals: 0 })} total interest.`;
}

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

  const { isReducedMotionActive } = useReducedMotion();

  const schedule = useMemo(
    () => buildSchedule(principal, apr, monthlyPayment, maxMonths),
    [principal, apr, monthlyPayment, maxMonths],
  );

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

  const liveMessage = useMemo(
    () => buildLiveMessage(schedule, tooltip, termMonths, totalInterest),
    [schedule, tooltip, termMonths, totalInterest],
  );

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
      <LiveRegion message={liveMessage} politeness="polite" />

      <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            style={{
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--font-bold)',
              color: `var(--text, ${COLOR.text})`,
              margin: 0,
            }}
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
          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: `var(--muted, ${COLOR.muted})`,
              margin: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {termMonths} month{termMonths !== 1 ? 's' : ''} ·{' '}
            {getNumberFormat('en-US', {
            {formatUsd(totalInterest, { decimals: 0 })} total interest
          </p>
        )}
      </header>

      {schedule.length === 0 ? (
        <EmptyStatePrompt />
      ) : (
        <>
          <div
            className="rv-chart-wrap"
            style={{ position: 'relative' }}
            data-reduced-motion={isReducedMotionActive ? 'true' : undefined}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <RepaymentChart
              schedule={schedule}
              tooltipId={tooltipId}
              onTooltip={setTooltip}
              tooltip={tooltip}
              chartAriaLabel={chartAriaLabel}
              reducedMotion={isReducedMotionActive}
            />

            {tooltip && (
              <div
                id={tooltipId}
                style={{ position: 'absolute', top: 'var(--space-2)', right: 'var(--space-2)' }}
              >
                <TooltipBubble data={tooltip} />
              </div>
            )}
          </div>

          <RepaymentLegend reducedMotion={isReducedMotionActive} />
          <ScenarioControls schedule={schedule} caption={caption} />
        </>
      )}
    </section>
  );
}

export default RepaymentVisualizer;
