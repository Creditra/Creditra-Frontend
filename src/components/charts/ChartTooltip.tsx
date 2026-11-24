import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import './charts.css';

export interface ChartTooltipPoint {
  /** Unique key for the data point. */
  key: string;
  /** SVG X coordinate. */
  x: number;
  /** SVG Y coordinate. */
  y: number;
  /** Primary label (e.g. date, week, day). */
  label: string;
  /** Formatted value string (e.g. "8.10%", "$4,200"). */
  value: string;
}

export interface ChartTooltipPointsProps {
  /** Interactive data points rendered as keyboard-focusable SVG targets. */
  points: readonly ChartTooltipPoint[];
  /** Currently focused or hovered point index, or `null`. */
  activeIndex: number | null;
  /** Callback when active point changes. */
  onActiveChange: (index: number | null) => void;
  /** Radius of the invisible pointer hit area in SVG units. */
  hitRadius?: number;
  /** Radius of the focus highlight ring in SVG units. */
  ringRadius?: number;
}

/**
 * Keyboard-focusable SVG point targets for `ChartTooltip`.
 *
 * Supports Tab focus, ArrowLeft / ArrowRight / Home / End navigation between
 * data points, Escape to dismiss, and mouse hover.
 */
export function ChartTooltipPoints({
  points,
  activeIndex,
  onActiveChange,
  hitRadius = 6,
  ringRadius = 4,
}: ChartTooltipPointsProps) {
  const itemRefs = useRef<Array<SVGGElement | null>>([]);

  const handleKeyDown = useCallback(
    (index: number, event: React.KeyboardEvent<SVGGElement>) => {
      if (points.length === 0) return;

      let nextIndex: number | null = null;
      if (event.key === 'ArrowRight') {
        nextIndex = Math.min(index + 1, points.length - 1);
      } else if (event.key === 'ArrowLeft') {
        nextIndex = Math.max(index - 1, 0);
      } else if (event.key === 'Home') {
        nextIndex = 0;
      } else if (event.key === 'End') {
        nextIndex = points.length - 1;
      } else if (event.key === 'Escape') {
        onActiveChange(null);
        return;
      }

      if (nextIndex !== null && nextIndex !== index) {
        event.preventDefault();
        onActiveChange(nextIndex);
        itemRefs.current[nextIndex]?.focus();
      }
    },
    [points.length, onActiveChange],
  );

  return (
    <g className="chart-tooltip__points">
      {points.map((point, index) => {
        const isActive = activeIndex === index;
        return (
          <g
            key={point.key}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className="chart-tooltip__point"
            data-active={isActive ? 'true' : 'false'}
            tabIndex={0}
            role="button"
            aria-label={`${point.label}: ${point.value}`}
            onFocus={() => onActiveChange(index)}
            onBlur={() => onActiveChange(null)}
            onMouseEnter={() => onActiveChange(index)}
            onMouseLeave={() => onActiveChange(null)}
            onKeyDown={(e) => handleKeyDown(index, e)}
          >
            <circle
              cx={point.x}
              cy={point.y}
              r={hitRadius}
              className="chart-tooltip__point-hit"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={ringRadius}
              className="chart-tooltip__point-ring"
            />
          </g>
        );
      })}
    </g>
  );
}

export interface ChartTooltipProps {
  /** Active point to display, or `null` when hidden. */
  point: ChartTooltipPoint | null;
}

/**
 * Accessible live-region tooltip popover rendered alongside a `ChartFrame`.
 * Remains hidden when no point is focused or hovered so chart visuals at rest
 * are unaffected.
 */
export function ChartTooltip({ point }: ChartTooltipProps) {
  if (!point) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="chart-tooltip__popover"
    >
      <span className="chart-tooltip__popover-label">{point.label}</span>
      <span className="chart-tooltip__popover-value">{point.value}</span>
    </div>
  );
}

/**
 * Convenience hook managing active tooltip index for a list of chart points.
 */
export function useChartTooltip(points: readonly ChartTooltipPoint[]) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activePoint =
    activeIndex !== null && activeIndex >= 0 && activeIndex < points.length
      ? points[activeIndex]
      : null;

  return { activeIndex, setActiveIndex, activePoint };
}
