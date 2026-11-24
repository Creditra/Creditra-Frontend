/**
 * Linear scale and SVG geometry helpers shared across Creditra chart components.
 *
 * Keeps coordinate projection, polyline generation, and area path construction
 * deterministic and free of division-by-zero / NaN edge cases.
 */

export interface LinearScale {
  /** Project a data-space value into SVG coordinate space. */
  (value: number): number;
  /** Input data domain `[min, max]`. */
  readonly domain: readonly [number, number];
  /** Output coordinate range `[start, end]`. */
  readonly range: readonly [number, number];
  /** Map an SVG coordinate back into data space. */
  invert: (coordinate: number) => number;
  /** Generate evenly spaced tick values across the domain. */
  ticks: (count?: number) => number[];
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Create a linear scale mapping `domain` `[d0, d1]` to `range` `[r0, r1]`.
 * When `d0 === d1`, maps every input to the midpoint of `range`.
 */
export function createLinearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const domainSpan = d1 - d0;
  const rangeSpan = r1 - r0;

  const scale = ((value: number): number => {
    if (domainSpan === 0) {
      return (r0 + r1) / 2;
    }
    return r0 + ((value - d0) / domainSpan) * rangeSpan;
  }) as LinearScale;

  Object.defineProperty(scale, 'domain', {
    value: [d0, d1] as const,
    enumerable: true,
  });
  Object.defineProperty(scale, 'range', {
    value: [r0, r1] as const,
    enumerable: true,
  });

  scale.invert = (coordinate: number): number => {
    if (rangeSpan === 0) {
      return (d0 + d1) / 2;
    }
    return d0 + ((coordinate - r0) / rangeSpan) * domainSpan;
  };

  scale.ticks = (count = 5): number[] => {
    if (count <= 1 || domainSpan === 0) {
      return [d0];
    }
    const step = domainSpan / (count - 1);
    return Array.from({ length: count }, (_, i) => d0 + i * step);
  };

  return scale;
}

/**
 * Format an array of 2D coordinates into an SVG `<polyline points="...">` string.
 */
export function buildPolylinePoints(
  points: readonly Point2D[],
  precision = 2,
): string {
  return points
    .map((p) => `${p.x.toFixed(precision)},${p.y.toFixed(precision)}`)
    .join(' ');
}

/**
 * Format an array of 2D coordinates into an SVG `<path d="M... L...">` string.
 */
export function buildLinePath(
  points: readonly Point2D[],
  precision = 2,
): string {
  if (points.length === 0) return '';
  return points
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${p.x.toFixed(precision)},${p.y.toFixed(precision)}`,
    )
    .join(' ');
}

/**
 * Build a closed SVG area `<path>` from `points` down to `baselineY`.
 */
export function buildAreaPath(
  points: readonly Point2D[],
  baselineY: number,
  precision = 2,
): string {
  if (points.length < 2) return '';
  const line = buildLinePath(points, precision);
  const first = points[0];
  const last = points[points.length - 1];
  const base = baselineY.toFixed(precision);
  return `${line} L${last.x.toFixed(precision)},${base} L${first.x.toFixed(precision)},${base} Z`;
}

/**
 * Build a closed SVG band/stacked area `<path>` between `topPoints` and `bottomPoints`.
 */
export function buildStackedAreaPath(
  topPoints: readonly Point2D[],
  bottomPoints: readonly Point2D[],
  precision = 2,
): string {
  if (topPoints.length === 0 || topPoints.length !== bottomPoints.length) {
    return '';
  }
  const top = topPoints
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(precision)} ${p.y.toFixed(precision)}`,
    )
    .join(' ');
  const bottom = [...bottomPoints]
    .reverse()
    .map((p) => `L ${p.x.toFixed(precision)} ${p.y.toFixed(precision)}`)
    .join(' ');
  return `${top} ${bottom} Z`;
}
