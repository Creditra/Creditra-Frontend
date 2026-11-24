import { useId } from 'react';
import type React from 'react';
import './charts.css';

export interface ChartFrameProps {
  /** ViewBox width (and optional SVG width attribute). */
  width: number;
  /** ViewBox height (and optional SVG height attribute). */
  height: number;
  /** Accessible summary title rendered in `<title>` and linked via `aria-labelledby`. */
  title: string;
  /** Optional extended accessible description rendered in `<desc>`. */
  description?: string;
  /** Optional `aria-label` override (if provided, used alongside `<title>`). */
  ariaLabel?: string;
  /** Whether to set explicit HTML `width` / `height` attributes on `<svg>`. */
  explicitDimensions?: boolean;
  /** SVG `preserveAspectRatio` attribute. */
  preserveAspectRatio?: string;
  /** CSS class applied to the `<svg>` element. */
  className?: string;
  /** Inline style applied to the `<svg>` element. */
  style?: React.CSSProperties;
  /** SVG child elements (paths, axes, tooltip targets, etc.). */
  children: React.ReactNode;
}

/**
 * Shared accessible SVG container for Creditra charts.
 *
 * Always exposes `role="img"` with a `<title>` (and optional `<desc>`)
 * linked via `aria-labelledby` so assistive technology announces a concise
 * summary of the visualization.
 */
export function ChartFrame({
  width,
  height,
  title,
  description,
  ariaLabel,
  explicitDimensions = false,
  preserveAspectRatio,
  className = '',
  style,
  children,
}: ChartFrameProps) {
  const titleId = useId();
  const descId = useId();
  const labelledBy = description ? `${titleId} ${descId}` : titleId;

  return (
    <svg
      width={explicitDimensions ? width : undefined}
      height={explicitDimensions ? height : undefined}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={preserveAspectRatio}
      role="img"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : labelledBy}
      focusable="false"
      className={`chart-frame__svg ${className}`.trim()}
      style={style}
    >
      <title id={titleId}>{title}</title>
      {description ? <desc id={descId}>{description}</desc> : null}
      {children}
    </svg>
  );
}
