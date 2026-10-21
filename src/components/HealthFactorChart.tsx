/**
 * HealthFactorChart — per-credit-line health-factor trend.
 *
 * Renders a compact SVG line chart of historical health-factor samples
 * for one credit line, with a colour-coded current value and an SR-only
 * data table fallback (WCAG 1.1.1).
 *
 * Health factor convention (Creditra):
 *   HF = limit / utilized when utilized > 0, else a sentinel "healthy" 3.0.
 *   Bands:  ≥ 2.0 safe (success) · 1.25–2.0 caution (warning) · < 1.25 risk (danger)
 *
 * Accessibility:
 *   - role="img" + aria-labelledby on the SVG
 *   - sr-only table mirrors every data point
 *   - prefers-reduced-motion disables the entrance stroke animation
 *   - Colour is paired with a text label (WCAG 1.4.1)
 *
 * Design tokens: stroke colours come from COLOR in utils/tokens.ts.
 */

import { useId, useMemo } from 'react';
import { COLOR } from '../utils/tokens';
import './HealthFactorChart.css';

export interface HealthFactorPoint {
  /** ISO date or label for the sample. */
  date: string;
  /** Health factor value (typically 0.5–5). */
  value: number;
}

export interface HealthFactorChartProps {
  /** Ordered oldest → newest samples. */
  data?: HealthFactorPoint[];
  /** Current health factor — shown as a badge. */
  current: number;
  /** Credit line name for accessible labelling. */
  lineName: string;
  width?: number;
  height?: number;
  className?: string;
}

export type HealthBand = 'safe' | 'caution' | 'risk';

export function healthBand(value: number): HealthBand {
  if (value >= 2) return 'safe';
  if (value >= 1.25) return 'caution';
  return 'risk';
}

export function healthBandColor(band: HealthBand): string {
  if (band === 'safe') return COLOR.success;
  if (band === 'caution') return COLOR.warning;
  return COLOR.danger;
}

export function healthBandLabel(band: HealthBand): string {
  if (band === 'safe') return 'Safe';
  if (band === 'caution') return 'Caution';
  return 'At risk';
}

/**
 * Derive a health factor from credit-line utilisation.
 * Used when no historical series is supplied by the backend yet.
 */
export function deriveHealthFactor(limit: number, utilized: number): number {
  if (utilized <= 0) return 3;
  if (limit <= 0) return 0.5;
  return Math.max(0.1, Number((limit / utilized).toFixed(2)));
}

/**
 * Build a short synthetic history ending at `current` for demo / offline use.
 */
export function buildHealthHistory(
  current: number,
  points = 12,
): HealthFactorPoint[] {
  const out: HealthFactorPoint[] = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    // Deterministic wobble — no Math.random (stable SSR + tests)
    const wobble = Math.sin(i * 0.7) * 0.12;
    const value = Math.max(
      0.5,
      Number((current + wobble * (i / Math.max(points - 1, 1))).toFixed(2)),
    );
    const d = new Date(now - i * 7 * 24 * 60 * 60 * 1000);
    out.push({ date: d.toISOString().slice(0, 10), value });
  }
  out[out.length - 1] = {
    ...out[out.length - 1],
    value: current,
  };
  return out;
}

const W_DEFAULT = 220;
const H_DEFAULT = 64;
const PAD = { top: 8, right: 8, bottom: 8, left: 8 };

export function HealthFactorChart({
  data = [],
  current,
  lineName,
  width = W_DEFAULT,
  height = H_DEFAULT,
  className = '',
}: HealthFactorChartProps) {
  const titleId = useId();
  const descId = useId();
  const band = healthBand(current);
  const stroke = healthBandColor(band);

  const { path, area, min, max } = useMemo(() => {
    if (!data.length) {
      return { path: '', area: '', min: 0, max: 1 };
    }
    const values = data.map((d) => d.value);
    const minV = Math.min(...values, 1);
    const maxV = Math.max(...values, 2.5);
    const range = maxV - minV || 1;
    const innerW = width - PAD.left - PAD.right;
    const innerH = height - PAD.top - PAD.bottom;

    const coords = data.map((d, i) => {
      const x =
        PAD.left +
        (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const y = PAD.top + innerH - ((d.value - minV) / range) * innerH;
      return [x, y] as const;
    });

    const line = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`)
      .join(' ');
    const areaPath =
      line +
      ` L${coords[coords.length - 1][0]},${PAD.top + innerH}` +
      ` L${coords[0][0]},${PAD.top + innerH} Z`;

    return { path: line, area: areaPath, min: minV, max: maxV };
  }, [data, width, height]);

  if (!data.length) {
    return (
      <div className={`hf-chart hf-chart--empty ${className}`} role="status">
        <span className="hf-chart__title">Health factor · {lineName}</span>
        <span className={`hf-chart__badge hf-chart__badge--${band} tabular-nums`}>
          {current.toFixed(2)} · {healthBandLabel(band)}
        </span>
        <span className="hf-chart__empty-caption">History not available yet</span>
        <span className="sr-only">
          Current health factor {current.toFixed(2)} ({healthBandLabel(band)}).
          The factor is the credit limit divided by the utilized balance; an
          unused line uses 3.00. Safe is 2.00 or higher, caution is 1.25 to
          below 2.00, and at risk is below 1.25.
        </span>
      </div>
    );
  }

  return (
    <figure className={`hf-chart ${className}`}>
      <figcaption className="hf-chart__caption">
        <span className="hf-chart__title">Health factor</span>
        <span
          className={`hf-chart__badge hf-chart__badge--${band} tabular-nums`}
          title={`Band: ${healthBandLabel(band)}`}
        >
          {current.toFixed(2)} · {healthBandLabel(band)}
        </span>
      </figcaption>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        className="hf-chart__svg"
      >
        <title id={titleId}>
          Health factor trend for {lineName}
        </title>
        <desc id={descId}>
          Current health factor {current.toFixed(2)} ({healthBandLabel(band)}).
          History of {data.length} observed points, from {min.toFixed(2)} to {max.toFixed(2)}.
          The factor is the credit limit divided by utilized balance; an unused
          line uses 3.00. Safe is 2.00 or higher, caution is 1.25 to below 2.00,
          and at risk is below 1.25.
        </desc>

        {/* Caution threshold guide at HF = 1.25 */}
        <line
          className="hf-chart__guide"
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + ((max - 1.25) / (max - min || 1)) * (height - PAD.top - PAD.bottom)}
          y2={PAD.top + ((max - 1.25) / (max - min || 1)) * (height - PAD.top - PAD.bottom)}
          stroke={COLOR.warning}
          strokeDasharray="4 3"
          strokeWidth={1}
          opacity={0.45}
          aria-hidden="true"
        />

        <path
          d={area}
          fill={stroke}
          fillOpacity={0.12}
          aria-hidden="true"
          className="hf-chart__area"
        />
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hf-chart__line"
        />
      </svg>

      <table className="sr-only" aria-label={`Health factor history for ${lineName}`}>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Health factor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{p.value.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default HealthFactorChart;
