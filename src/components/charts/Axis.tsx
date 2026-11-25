import type { LinearScale } from './scales';

export interface AxisTick {
  /** Data-space value to project through `scale`. */
  value: number;
  /** Human-readable tick label. */
  label: string;
}

export interface AxisProps {
  /** Axis orientation. */
  orientation: 'bottom' | 'left';
  /** Linear scale used to position tick labels along the axis. */
  scale: LinearScale;
  /** Tick entries to render. */
  ticks: readonly AxisTick[];
  /** Axis line coordinate (`y` for bottom axis, `x` for left axis). */
  position: number;
  /** Offset in SVG units from the axis line to the label text. */
  labelOffset?: number;
  /** Optional class for the axis baseline `<line>`. */
  lineClassName?: string;
  /** Optional class for tick `<text>` elements. */
  labelClassName?: string;
  /** Whether to draw the axis baseline `<line>`. Defaults to `true`. */
  showLine?: boolean;
}

/**
 * Shared SVG axis primitive rendering a baseline and positioned tick labels.
 * Marked `aria-hidden="true"` because the accessible data is exposed via
 * `ChartFrame` summary and `ChartDataTable`.
 */
export function Axis({
  orientation,
  scale,
  ticks,
  position,
  labelOffset = 16,
  lineClassName,
  labelClassName,
  showLine = true,
}: AxisProps) {
  const [r0, r1] = scale.range;

  if (orientation === 'bottom') {
    return (
      <g aria-hidden="true">
        {showLine ? (
          <line
            x1={r0}
            y1={position}
            x2={r1}
            y2={position}
            className={lineClassName}
          />
        ) : null}
        {ticks.map((tick) => (
          <text
            key={`${tick.value}-${tick.label}`}
            x={scale(tick.value)}
            y={position + labelOffset}
            textAnchor="middle"
            className={labelClassName}
          >
            {tick.label}
          </text>
        ))}
      </g>
    );
  }

  return (
    <g aria-hidden="true">
      {showLine ? (
        <line
          x1={position}
          y1={r0}
          x2={position}
          y2={r1}
          className={lineClassName}
        />
      ) : null}
      {ticks.map((tick) => (
        <text
          key={`${tick.value}-${tick.label}`}
          x={position - labelOffset}
          y={scale(tick.value)}
          textAnchor="end"
          dominantBaseline="middle"
          className={labelClassName}
        >
          {tick.label}
        </text>
      ))}
    </g>
  );
}
