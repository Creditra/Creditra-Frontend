/**
 * RiskGauge
 *
 * Renders a semicircular SVG arc gauge for a 0–100 risk score.
 *
 * Animation behaviour
 * ─────────────────────────────────────────────────────────────────────────────
 * On first mount the arc sweeps from empty (full dashoffset = circumference)
 * to the target value via a CSS @keyframes animation, gated by the
 * `[data-initial-sweep="true"]` attribute (see RiskGauge.css).
 *
 * On every subsequent score change the fill <path> is a stable element (no
 * remount) and simply receives a new `stroke-dashoffset`; a CSS `transition`
 * on `.risk-gauge-fill` glides from the previous value to the new one. This
 * avoids replaying the full empty→value sweep on every minor live update,
 * which previously looked like a flash/reset on each change.
 *
 * Reduced-motion
 * ─────────────────────────────────────────────────────────────────────────────
 * Two layers of protection:
 *   1. CSS:  `@media (prefers-reduced-motion: reduce)` disables the keyframe and
 *      sets `transition: none` so the fill jumps straight to its final value.
 *   2. JS:   `useReducedMotion()` hook reads `matchMedia` synchronously so the
 *      initial render never starts at offset = circumference before snapping —
 *      there is no flash-of-empty-gauge for reduced-motion users.
 *
 * Theme-aware stroke
 * ─────────────────────────────────────────────────────────────────────────────
 * The fill stroke is set via `color` (currentColor) so it inherits the semantic
 * `--success / --warning / --error` tokens set inline on the wrapper element.
 * No hardcoded hex values appear in this file.
 *
 * SR text
 * ─────────────────────────────────────────────────────────────────────────────
 * The SVG carries `role="img"` and `aria-labelledby` pointing at a hidden
 * `<title>` element.  A sibling `<p className="sr-only">` duplicates the
 * description outside the SVG for AT implementations that skip inline SVG titles.
 *
 * Focus ring (keyboard accessibility)
 * ─────────────────────────────────────────────────────────────────────────────
 * The SVG is made keyboard-focusable via `tabIndex={0}`.  A CSS `:focus-visible`
 * rule renders a visible ring around the whole gauge using `box-shadow` (since
 * SVG elements have inconsistent `outline` support across browsers).
 *
 * Three interactive gauge sectors (low / medium / high risk) are grouped in
 * individual `<g>` elements that are also keyboard-focusable (tabIndex={0}).
 * Each sector carries its own `<title>` for accessible description and shows
 * its own focus ring via a `<rect>` overlay whose visibility is driven by CSS
 * `:focus-visible` on the parent `<g>`.  Pressing Enter or Space on a focused
 * sector triggers `onSectorActivate` if provided.
 *
 * Focus ring implementation
 * ─────────────────────────────────────────────────────────────────────────────
 * The focus ring uses shared design tokens defined in `src/styles/focus.css`:
 *   - `--focus-ring-color`   → accent color (default #58a6ff, white in high-contrast)
 *   - `--focus-ring-width`   → 2px (WCAG 2.4.11 minimum)
 *   - `--focus-ring-offset`  → 3px
 *   - `--focus-ring-radius`  → 6px
 *
 * These tokens ensure consistent focus appearance across all components.
 * The `:focus-visible` pseudo-class ensures rings only appear during keyboard
 * navigation, not on mouse/touch interactions.
 *
 * WCAG 2.1 AA Compliance:
 *   - Focus indicator area ≥ perimeter × 2px (WCAG 2.4.11)
 *   - High contrast (5.9:1 default, 21:1 in high-contrast mode)
 *   - Visible only on keyboard navigation (:focus-visible)
 *   - Not suppressed by prefers-reduced-motion (focus rings must remain visible)
 *
 * @see src/styles/focus.css for shared focus-ring design tokens
 * @see https://www.w3.org/TR/WCAG21/#focus-visible
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useReducedMotion } from '../context/ReducedMotionContext';
import { LiveRegion } from './LiveRegion';
import { RiskGaugeSkeleton } from './Skeleton';
import './RiskGauge.css';
import '../styles/patterns.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The three risk band labels that can receive focus independently. */
export type RiskSector = 'low' | 'medium' | 'high';

export interface RiskGaugeProps {
  loading?: boolean;
  /** Risk score 0–100. Values outside this range are clamped. */
  score: number;
  trend: 'improving' | 'declining' | 'stable';
  lastUpdated: string;
  /**
   * Optional callback fired when the user activates a gauge sector via
   * keyboard (Enter / Space) or pointer click.  Receives the sector label.
   */
  onSectorActivate?: (sector: RiskSector) => void;
  /**
   * When true (default) the three risk-band sectors are rendered as
   * focusable elements with descriptive labels.  Set to false to render
   * a purely presentational gauge (e.g. in print layouts).
   */
  showSectors?: boolean;
  /**
   * Override the accessible label for the gauge SVG element.
   *
   * By default the SVG's `<title>` (and the sibling `<p className="sr-only">`)
   * read: "Risk score N out of 100. Trend: X. Last updated D."
   *
   * Supply a custom string when you need a more specific or branded
   * description — e.g. "Creditra risk score: 78 (Excellent)".
   *
   * Note: this value replaces the auto-generated description in both the
   * SVG title and the live-region paragraph, keeping them in sync.
   */
  ariaLabel?: string;
  /**
   * When true (default) a visually-hidden `<table>` sibling is rendered
   * adjacent to the gauge SVG.  The table lists all three risk bands with
   * their score ranges and marks the band the current score falls in.
   *
   * Screen readers announce this table when the gauge receives focus,
   * giving users a structured breakdown without navigating the SVG
   * arc sectors individually.
   *
   * Set to false only when the caller renders its own equivalent structure
   * to avoid duplicate content for AT users.
   */
  showSRTable?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS = 55;
const CX = 80;
const CY = 75;
/** Length of a 180° arc at RADIUS. */
const CIRCUMFERENCE = Math.PI * RADIUS; // ≈ 172.79

const TREND_ARROW: Record<RiskGaugeProps['trend'], string> = {
  improving: '▲',
  declining: '▼',
  stable: '─',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the CSS custom property name for the arc stroke colour.
 * Using `var(--…)` here means the colour follows `[data-contrast="high"]`
 * overrides automatically.
 */
function gaugeColorVar(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--error)';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Builds an SVG arc path that spans `startAngle` → `endAngle` (degrees, 0 =
 * left end of the semicircle, 180 = right end).
 * The gauge is a 180° arc, so angles map directly onto percentage of arc.
 */
function sectorArcPath(startDeg: number, endDeg: number): string {
  // Convert gauge angles (0 = left, 180 = right) to screen coordinates.
  const toRad = (deg: number) => ((deg - 180) * Math.PI) / 180;
  const sx = CX + RADIUS * Math.cos(toRad(startDeg));
  const sy = CY + RADIUS * Math.sin(toRad(startDeg));
  const ex = CX + RADIUS * Math.cos(toRad(endDeg));
  const ey = CY + RADIUS * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${ex} ${ey}`;
}

// ─── Sub-component: interactive gauge sector ──────────────────────────────────

/**
 * Sector band definitions.
 *
 * Each sector occupies 60° of the 180° arc:
 *   high   (≥70)  →   0°– 60°  (left third)
 *   medium (≥50)  →  60°–120°  (middle third)
 *   low    (<50)  → 120°–180°  (right third)
 *
 * NOTE: The arc renders left→right, so "high" score (good) lives on the left
 * and "low" score (risky) on the right, matching common gauge conventions.
 */
const SECTORS: Array<{
  id: RiskSector;
  label: string;
  startDeg: number;
  endDeg: number;
  colorVar: string;
  range: string;
}> = [
  {
    id: 'high',
    label: 'High score zone',
    startDeg: 0,
    endDeg: 60,
    colorVar: 'var(--success)',
    range: '70–100',
  },
  {
    id: 'medium',
    label: 'Medium score zone',
    startDeg: 60,
    endDeg: 120,
    colorVar: 'var(--warning)',
    range: '50–69',
  },
  {
    id: 'low',
    label: 'Low score zone',
    startDeg: 120,
    endDeg: 180,
    colorVar: 'var(--error)',
    range: '0–49',
  },
];

interface SectorGroupProps {
  sector: (typeof SECTORS)[number];
  isActive: boolean;
  onActivate: (id: RiskSector) => void;
  titleId: string;
}

/**
 * SectorGroup
 *
 * A focusable `<g>` element representing one risk band on the gauge.
 *
 * Focus ring implementation
 * ──────────────────────────
 * An SVG `<rect>` overlay (`risk-gauge-sector-focus-rect`) is rendered
 * behind the sector arc and made visible only when the `<g>` receives
 * `:focus-visible`.  This is the most cross-browser-compatible way to
 * paint a focus ring inside an SVG: `outline` is supported inconsistently
 * on SVG `<g>` elements, while `box-shadow` requires the element to have
 * a CSS box model.  The `<rect>` approach works in all tested environments
 * (Chrome 118+, Firefox 120+, Safari 17+).
 */
function SectorGroup({ sector, isActive, onActivate, titleId }: SectorGroupProps) {
  const sectorPath = sectorArcPath(sector.startDeg, sector.endDeg);

  function handleKeyDown(e: KeyboardEvent<SVGGElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onActivate(sector.id);
    }
  }

  return (
    <g
      className="risk-gauge-sector"
      role="button"
      tabIndex={0}
      aria-labelledby={titleId}
      aria-pressed={isActive}
      data-sector={sector.id}
      onClick={() => onActivate(sector.id)}
      onKeyDown={handleKeyDown}
    >
      {/* Accessible sector title — announced by AT when this <g> is focused */}
      <title id={titleId}>
        {sector.label} (scores {sector.range})
      </title>

      {/*
        Invisible hit-area rect behind the sector arc.
        Makes the focus ring paint as a rounded rectangle rather than
        following the arc stroke, which is more legible.
        class="risk-gauge-sector-focus-rect" is shown by CSS only on
        :focus-visible of the parent <g>.
      */}
      <rect
        className="risk-gauge-sector-focus-rect"
        x={CX - RADIUS - 6}
        y={CY - RADIUS - 6}
        width={(RADIUS + 6) * 2}
        height={RADIUS + 12}
        rx="8"
        aria-hidden="true"
      />

      {/* The visible sector arc band */}
      <path
        className={`risk-gauge-sector-arc risk-gauge-pattern--${sector.id}`}
        d={sectorPath}
        stroke={sector.colorVar}
        aria-hidden="true"
        data-sector-arc={sector.id}
      />

      {/* Active-score indicator dot — rendered on the sector the score falls in */}
      {isActive && (
        <circle
          className="risk-gauge-sector-dot"
          cx={CX}
          cy={CY - RADIUS}
          r={4}
          fill={sector.colorVar}
          aria-hidden="true"
          data-active-dot={sector.id}
        />
      )}
    </g>
  );
}

// ─── SR table sibling ─────────────────────────────────────────────────────────

/**
 * RiskGaugeSRTable
 *
 * A visually-hidden `<table>` rendered as a sibling of the gauge SVG.
 * It lists all three risk bands with their score ranges and marks the band
 * that the current score falls in with `aria-current="true"`.
 *
 * This gives assistive-technology users a navigable, structured alternative
 * to the arc visualisation without requiring them to interact with the SVG
 * sectors individually.
 *
 * The table is hidden from sighted users with `.sr-only` and `aria-hidden`
 * is NOT set — it should be read by screen readers.
 */
interface RiskGaugeSRTableProps {
  normalizedScore: number;
  activeSector: RiskSector;
}

function RiskGaugeSRTable({ normalizedScore, activeSector }: RiskGaugeSRTableProps) {
  return (
    <table
      className="sr-only"
      aria-label="Risk score band breakdown"
      style={{ borderCollapse: 'collapse' }}
    >
      <caption className="sr-only">
        Risk score bands. Current score: {normalizedScore} out of 100.
      </caption>
      <thead>
        <tr>
          <th scope="col">Band</th>
          <th scope="col">Score range</th>
          <th scope="col">Current score</th>
        </tr>
      </thead>
      <tbody>
        {SECTORS.map((sector) => {
          const isCurrent = activeSector === sector.id;
          return (
            <tr key={sector.id} aria-current={isCurrent ? 'true' : undefined}>
              <td>{sector.label}</td>
              <td>{sector.range}</td>
              <td>{isCurrent ? `Yes — ${normalizedScore}` : 'No'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RiskGauge({
  loading,
  score,
  trend,
  lastUpdated,
  onSectorActivate,
  showSectors = true,
  ariaLabel,
  showSRTable = true,
}: RiskGaugeProps) {
  if (loading) {
    return <RiskGaugeSkeleton />;
  }

  const normalizedScore = Math.min(100, Math.max(0, score));
  const offset = CIRCUMFERENCE - (normalizedScore / 100) * CIRCUMFERENCE;
  const colorVar = gaugeColorVar(normalizedScore);
  const { isReducedMotionActive: reducedMotion } = useReducedMotion();

  /**
   * Arc path descriptor (shared between bg and fill).
   * Starts at the left end of the semicircle, sweeps clockwise to the right.
   */
  const arcPath = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  /**
   * Distinguishes the very first paint from subsequent re-renders. Only the
   * first paint gets the full empty→value @keyframes sweep; later score
   * changes instead transition in place (see `dashoffset` below and the
   * `.risk-gauge-fill` CSS transition).
   */
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);
  const isInitialSweep = !reducedMotion && isFirstRenderRef.current;

  /**
   * On the initial sweep we start at full circumference so the @keyframes
   * animation has somewhere to sweep from. Every other render — including
   * when reduced motion is active — goes straight to the target offset;
   * for reduced motion this avoids any flash-of-empty-arc, and for later
   * score changes it lets the CSS transition animate from the previous
   * dashoffset to this one.
   */
  const dashoffset = isInitialSweep ? CIRCUMFERENCE : offset;

  // Unique ID for aria-labelledby — stable across renders.
  const titleId = useRef(`risk-gauge-title-${Math.random().toString(36).slice(2)}`).current;

  // Unique IDs for each sector title element.
  const sectorTitleIdBase = useRef(
    `risk-gauge-sector-title-${Math.random().toString(36).slice(2)}`,
  ).current;

  const trendLabel = trend.charAt(0).toUpperCase() + trend.slice(1);
  const trendArrow = TREND_ARROW[trend];

  const srDescription = useMemo(
    () =>
      ariaLabel ??
      `Risk score ${normalizedScore} out of 100. Trend: ${trendLabel}. Last updated ${formatDate(lastUpdated)}.`,
    [ariaLabel, normalizedScore, trendLabel, lastUpdated],
  );

  const [liveMessage, setLiveMessage] = useState<string>(srDescription);

  // Announce the main score description whenever it changes
  useMemo(() => {
    setLiveMessage(srDescription);
  }, [srDescription]);

  const activeSector: RiskSector =
    normalizedScore >= 70 ? 'high' : normalizedScore >= 50 ? 'medium' : 'low';

  function handleSectorActivate(sector: RiskSector) {
    const sectorDef = SECTORS.find((s) => s.id === sector);
    if (sectorDef) {
      setLiveMessage(`Activated ${sectorDef.label}, scores ${sectorDef.range}`);
    }
    onSectorActivate?.(sector);
  }

  /**
   * The SVG itself is also keyboard-focusable (tabIndex={0}) so users who
   * don't need per-sector granularity can still reach the widget in a single
   * Tab stop.  The SVG focus ring is rendered via box-shadow in RiskGauge.css
   * since SVG elements have inconsistent `outline` support across browsers.
   */
  function handleSvgKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    // Pressing Enter/Space on the gauge SVG activates the current score's sector.
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSectorActivate(activeSector);
    }
  }

  return (
    <div className="risk-gauge-container">
      {/* Screen-reader description outside SVG for AT implementations that
          skip <title> inside inline SVG. */}
      <LiveRegion message={liveMessage} />

      {/*
        SR-only table listing the three risk bands with ranges.
        Gives AT users a structured alternative to the arc sectors so they
        can understand the full band context without interacting with SVG.
        Hidden from sighted users via .sr-only; always present in the
        accessibility tree (no aria-hidden).
        Rendered before the SVG so it appears early in reading order.
      */}
      {showSRTable && (
        <RiskGaugeSRTable
          normalizedScore={normalizedScore}
          activeSector={activeSector}
        />
      )}

      <svg
        className="risk-gauge-svg"
        viewBox="0 0 160 100"
        role="img"
        aria-labelledby={titleId}
        aria-hidden="false"
        /*
          tabIndex={0} makes the SVG reachable via keyboard Tab navigation.
          The focus ring is provided by `.risk-gauge-svg:focus-visible` in
          RiskGauge.css using box-shadow (more reliable on SVG than outline).
        */
        tabIndex={0}
        onKeyDown={handleSvgKeyDown}
        data-active-sector={activeSector}
      >
        {/* SVG title — announced by AT when the SVG itself is focused */}
        <title id={titleId}>{srDescription}</title>

        {/* Background track */}
        <path
          className="risk-gauge-bg"
          d={arcPath}
          aria-hidden="true"
        />

        {/*
          Interactive sector bands.
          Rendered below the fill arc so the fill visually overlays them,
          but each sector <g> remains independently keyboard-focusable.
          Hidden when showSectors=false (e.g. print / purely decorative use).
        */}
        {showSectors &&
          SECTORS.map((sector) => (
            <SectorGroup
              key={sector.id}
              sector={sector}
              isActive={activeSector === sector.id}
              onActivate={handleSectorActivate}
              titleId={`${sectorTitleIdBase}-${sector.id}`}
            />
          ))}

        {/*
          Fill arc.
          No longer remounted on score change — stroke-dashoffset updates in
          place and RiskGauge.css transitions between values. Only the very
          first paint (data-initial-sweep="true") gets the full empty→value
          @keyframes sweep.
        */}
        <path
          className="risk-gauge-fill"
          d={arcPath}
          stroke={colorVar}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
          style={
            {
              '--gauge-target-offset': offset,
              '--gauge-circumference': CIRCUMFERENCE,
            } as React.CSSProperties
          }
          aria-hidden="true"
          data-score={normalizedScore}
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
          data-initial-sweep={isInitialSweep ? 'true' : undefined}
        />

        {/* Score numeral */}
        <text
          x={CX}
          y={CY - 12}
          className="risk-gauge-score"
          aria-hidden="true"
        >
          {normalizedScore}
        </text>

        {/* "Risk Score" label */}
        <text
          x={CX}
          y={CY - 38}
          className="risk-gauge-label"
          aria-hidden="true"
        >
          Risk Score
        </text>
      </svg>

      <div className="risk-meta" aria-hidden="true">
        <div className="risk-meta-item">
          <span className="rm-label">Trend</span>
          <span
            className="rm-value"
            style={{ color: `var(--${trend === 'improving' ? 'success' : trend === 'declining' ? 'error' : 'muted'})` }}
          >
            {trendArrow} {trendLabel}
          </span>
        </div>
        <div className="risk-meta-item">
          <span className="rm-label">Last Updated</span>
          <span className="rm-value" style={{ color: 'var(--muted)' }}>
            {formatDate(lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
}
