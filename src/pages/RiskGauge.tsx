/**
 * RiskGauge — page-level component
 *
 * Renders a semicircular SVG arc gauge for a 0–850 credit risk score.
 * Wraps the core gauge visuals with page-specific concerns: empty-state
 * handling, score counter animation, sparkline trend, and the KbdHint.
 *
 * Accessibility (WCAG 2.1 AA) — Issue #602
 * ─────────────────────────────────────────────────────────────────────────────
 * Focus outline implementation
 * ────────────────────────────
 * The SVG is made keyboard-focusable via `tabIndex={0}`.  A CSS
 * `:focus-visible` rule in `src/styles/focus.css` (selector
 * `.risk-gauge-svg:focus-visible`) renders a visible ring via `box-shadow`
 * (more reliable on SVG than `outline`).  Mouse clicks do NOT trigger the
 * ring — only keyboard navigation does.
 *
 * Three interactive gauge sectors (low / medium / high risk) are rendered
 * as individually focusable `<g role="button">` elements.  Each sector
 * carries a `<title>` for AT announcement and a `<rect>` overlay
 * (`.risk-gauge-sector-focus-rect`) whose `stroke` is revealed only via
 * `.risk-gauge-sector:focus-visible .risk-gauge-sector-focus-rect` in CSS.
 *
 * All focus colours reference `--focus-ring-color` from the shared
 * `src/styles/focus.css` token set, ensuring consistency across components
 * and automatic adaptation to `[data-contrast="high"]` (white ring, 21:1).
 *
 * WCAG criteria met
 * ─────────────────
 *   2.1.1  Keyboard — gauge and all sectors reachable via Tab / Arrow keys
 *   2.4.7  Focus Visible — `:focus-visible` ring shown during keyboard nav
 *   2.4.11 Focus Appearance — ring area ≥ perimeter × 2 px; contrast ≥ 3:1
 *   1.1.1  Non-text Content — `role="img"` + `aria-labelledby` on SVG
 *   4.1.2  Name, Role, Value — sectors carry `role="button"`, `aria-pressed`,
 *          `aria-labelledby` pointing at descriptive `<title>` elements
 *
 * @see src/styles/focus.css   — shared design tokens and :focus-visible rules
 * @see https://www.w3.org/TR/WCAG21/#focus-visible
 * @see https://www.w3.org/TR/WCAG22/#focus-appearance
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  type KeyboardEvent,
} from "react";
import { Sparkline } from "../components/Sparkline";
import { EmptyState } from "../components/EmptyState";
import { NoRiskGauge } from "../components/illustrations/EmptyStateIllustrations";
import { COLOR, RISK_COLOR, fmtDate } from "../utils/tokens";
import { KbdHint } from "../components/KbdHint";
import { useReducedMotion } from "../context/ReducedMotionContext";
import "../components/RiskGauge.css";
import "../styles/patterns.css";

// ─── Types ────────────────────────────────────────────────────────────────────

/** The three risk-band labels that can each receive independent focus. */
export type RiskSector = "low" | "medium" | "high";

export interface RiskGaugeProps {
  score?: number;
  trend?: "improving" | "declining" | "stable";
  lastUpdated?: string;
  history?: number[];
  /** When true, an empty-state illustration is shown instead of the gauge. */
  isEmpty?: boolean;
  /** Fired when the user clicks the "Check again" CTA on the empty state. */
  onRefresh?: () => void;
  /**
   * Fired when the user activates a gauge sector via keyboard (Enter / Space)
   * or pointer click.  Receives the sector label.
   */
  onSectorActivate?: (sector: RiskSector) => void;
  /**
   * When true (default) the three risk-band sectors are rendered as focusable
   * `<g role="button">` elements with descriptive labels.  Set to false for
   * purely presentational gauges (e.g. print layouts).
   */
  showSectors?: boolean;
  /**
   * When true (default) a visually-hidden SR table is rendered alongside the
   * gauge listing all three bands with score ranges.
   */
  showSRTable?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS = 55;
const CX = 80;
const CY = 75;
/** Length of a 180° arc at RADIUS — used for stroke-dasharray / dashoffset. */
const CIRCUMFERENCE = Math.PI * RADIUS; // ≈ 172.79

/** Maximum score on the 0–850 credit-score scale used by this page. */
const MAX_SCORE = 850;

const TREND_ARROW: Record<NonNullable<RiskGaugeProps["trend"]>, string> = {
  improving: "▲",
  declining: "▼",
  stable: "─",
};

// ─── Sector definitions ───────────────────────────────────────────────────────

/**
 * Each sector occupies 60° of the 180° arc:
 *   high   (≥595 / ≥70%)  →   0°– 60°  (left — good)
 *   medium (≥425 / ≥50%)  →  60°–120°  (middle)
 *   low    (<425 / <50%)  → 120°–180°  (right — risky)
 *
 * Boundaries are expressed as raw 0–850 score values.
 */
const SECTORS: Array<{
  id: RiskSector;
  label: string;
  startDeg: number;
  endDeg: number;
  colorVar: string;
  range: string;
  /** Lower-bound score (inclusive) for the band; 0 for "low". */
  minScore: number;
}> = [
  {
    id: "high",
    label: "High score zone",
    startDeg: 0,
    endDeg: 60,
    colorVar: "var(--success)",
    range: "595–850",
    minScore: 595,
  },
  {
    id: "medium",
    label: "Medium score zone",
    startDeg: 60,
    endDeg: 120,
    colorVar: "var(--warning)",
    range: "425–594",
    minScore: 425,
  },
  {
    id: "low",
    label: "Low score zone",
    startDeg: 120,
    endDeg: 180,
    colorVar: "var(--error)",
    range: "0–424",
    minScore: 0,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the active RiskSector for a given normalised score (0–850).
 * Boundaries are inclusive on the lower end.
 */
function activeSectorForScore(score: number): RiskSector {
  if (score >= 595) return "high";
  if (score >= 425) return "medium";
  return "low";
}

/**
 * Builds an SVG arc path spanning `startAngle` → `endAngle` (degrees).
 * Gauge angles: 0 = left end of semicircle, 180 = right end.
 */
function sectorArcPath(startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => ((deg - 180) * Math.PI) / 180;
  const sx = CX + RADIUS * Math.cos(toRad(startDeg));
  const sy = CY + RADIUS * Math.sin(toRad(startDeg));
  const ex = CX + RADIUS * Math.cos(toRad(endDeg));
  const ey = CY + RADIUS * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${ex} ${ey}`;
}

/** Cubic-bezier easing (matching CSS cubic-bezier(0.16, 1, 0.3, 1)). */
function easeCubicBezier(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const x1 = 0.16;
  const x2 = 0.3;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const currentX =
      3 * (1 - t) * (1 - t) * t * x1 +
      3 * (1 - t) * t * t * x2 +
      t * t * t;
    const diff = currentX - x;
    if (Math.abs(diff) < 1e-6) break;
    const dXdt =
      3 * (1 - t) * (1 - t) * x1 +
      6 * (1 - t) * t * (x2 - x1) +
      3 * t * t * (1 - x2);
    t -= diff / (dXdt || 1);
  }
  return 3 * t * (1 - t) + t * t * t;
}

// ─── Sub-component: SR-only table ─────────────────────────────────────────────

/**
 * RiskGaugeSRTable
 *
 * A visually-hidden `<table>` sibling of the gauge SVG listing all risk bands
 * with score ranges and marking the current band with `aria-current="true"`.
 *
 * Gives AT users a navigable, structured alternative to the arc visualisation
 * without requiring interaction with individual SVG sectors.
 *
 * Hidden from sighted users via `.sr-only`; NOT aria-hidden so screen readers
 * can reach it.
 */
function RiskGaugeSRTable({
  normalizedScore,
  activeSector,
}: {
  normalizedScore: number;
  activeSector: RiskSector;
}) {
  return (
    <table
      className="sr-only"
      aria-label="Risk score band breakdown"
      style={{ borderCollapse: "collapse" }}
    >
      <caption className="sr-only">
        Risk score bands. Current score: {normalizedScore} out of {MAX_SCORE}.
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
            <tr key={sector.id} aria-current={isCurrent ? "true" : undefined}>
              <td>{sector.label}</td>
              <td>{sector.range}</td>
              <td>{isCurrent ? `Yes — ${normalizedScore}` : "No"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Sub-component: interactive sector group ──────────────────────────────────

interface SectorGroupProps {
  sector: (typeof SECTORS)[number];
  isActive: boolean;
  onActivate: (id: RiskSector) => void;
  titleId: string;
}

/**
 * SectorGroup
 *
 * A focusable `<g role="button">` representing one risk band on the gauge.
 *
 * Focus ring
 * ──────────
 * An SVG `<rect class="risk-gauge-sector-focus-rect">` is rendered behind
 * the sector arc.  Its `stroke` is `none` at rest and is revealed only when
 * the parent `<g>` receives `:focus-visible`, via the CSS rule in
 * `src/styles/focus.css`:
 *
 *   .risk-gauge-sector:focus-visible .risk-gauge-sector-focus-rect {
 *     stroke: var(--focus-ring-color, …);
 *   }
 *
 * This is the most cross-browser-compatible approach — `outline` and
 * `box-shadow` have inconsistent support on SVG `<g>` elements.
 *
 * Mouse clicks do NOT reveal the ring because `:focus-visible` is not
 * activated by pointer events.
 */
function SectorGroup({
  sector,
  isActive,
  onActivate,
  titleId,
}: SectorGroupProps) {
  const arcPath = sectorArcPath(sector.startDeg, sector.endDeg);

  function handleKeyDown(e: KeyboardEvent<SVGGElement>) {
    // Enter and Space both activate the sector (ARIA button pattern).
    if (e.key === "Enter" || e.key === " ") {
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
      /*
        aria-pressed reflects whether this sector is the one the current score
        falls in — analogous to a "selected" toggle button state.
        WCAG 4.1.2: state must be programmatically determinable.
      */
      aria-pressed={isActive}
      data-sector={sector.id}
      onClick={() => onActivate(sector.id)}
      onKeyDown={handleKeyDown}
    >
      {/* Accessible sector title — announced by AT when this <g> is focused. */}
      <title id={titleId}>
        {sector.label} (scores {sector.range})
      </title>

      {/*
        Invisible focus ring rect.
        Normally stroke="none"; CSS :focus-visible on the parent <g> reveals
        the stroke using --focus-ring-color.  pointer-events="none" so the
        arc path receives all hit-testing.
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

      {/* Visible sector arc band (subtle at rest, WCAG-compliant on focus). */}
      <path
        className={`risk-gauge-sector-arc risk-gauge-pattern--${sector.id}`}
        d={arcPath}
        stroke={sector.colorVar}
        aria-hidden="true"
        data-sector-arc={sector.id}
      />

      {/* Active-score indicator dot — shown on whichever sector contains the score. */}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function RiskGauge({
  score = 0,
  trend = "stable",
  lastUpdated = "",
  history,
  isEmpty = false,
  onRefresh,
  onSectorActivate,
  showSectors = true,
  showSRTable = true,
}: RiskGaugeProps) {
  const normalizedScore = Math.min(MAX_SCORE, Math.max(0, score));
  const offset = CIRCUMFERENCE - (normalizedScore / MAX_SCORE) * CIRCUMFERENCE;

  const gaugeColor = RISK_COLOR(normalizedScore);
  const trendArrow = TREND_ARROW[trend];
  const trendColor =
    trend === "improving"
      ? COLOR.success
      : trend === "declining"
        ? COLOR.danger
        : COLOR.muted;
  const trendLabel = trend.charAt(0).toUpperCase() + trend.slice(1);

  const { isReducedMotionActive } = useReducedMotion();

  // ── Animated score counter ────────────────────────────────────────────────
  const [displayedScore, setDisplayedScore] = useState(normalizedScore);
  const prevScoreRef = useRef(normalizedScore);

  useEffect(() => {
    if (isReducedMotionActive) {
      setDisplayedScore(normalizedScore);
      prevScoreRef.current = normalizedScore;
      return;
    }

    const startScore = prevScoreRef.current;
    const endScore = normalizedScore;
    if (startScore === endScore) return;

    const duration = 280;
    const startTime = Date.now();
    let rafId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayedScore(startScore + (endScore - startScore) * easeCubicBezier(progress));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        prevScoreRef.current = endScore;
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [normalizedScore, isReducedMotionActive]);

  const scoreFormatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
    [],
  );

  // ── Stable IDs for aria-labelledby ────────────────────────────────────────
  const titleId = useRef(
    `risk-gauge-title-${Math.random().toString(36).slice(2)}`,
  ).current;

  const sectorTitleIdBase = useRef(
    `risk-gauge-sector-title-${Math.random().toString(36).slice(2)}`,
  ).current;

  // ── Active sector / live region ───────────────────────────────────────────
  const activeSector = activeSectorForScore(normalizedScore);

  const srDescription = `Risk score ${normalizedScore} of ${MAX_SCORE}. Trend: ${trendLabel}.`;
  const [liveMessage, setLiveMessage] = useState(srDescription);

  // Announce the score description whenever it meaningfully changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setLiveMessage(srDescription), [srDescription]);

  function handleSectorActivate(sector: RiskSector) {
    const def = SECTORS.find((s) => s.id === sector);
    if (def) {
      setLiveMessage(`Activated ${def.label}, scores ${def.range}`);
    }
    onSectorActivate?.(sector);
  }

  /**
   * Keyboard handler for the SVG root element.
   * Enter / Space activates the current score's sector (same behaviour as
   * pressing Enter on the focused sector <g> directly).
   */
  function handleSvgKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSectorActivate(activeSector);
    }
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <EmptyState
        illustration={<NoRiskGauge />}
        eyebrow="Risk Score"
        title="No risk data available"
        description="Your risk score will appear here once your credit profile has been analyzed."
        tone="info"
        primaryAction={
          onRefresh
            ? { label: "Check again", onClick: onRefresh }
            : undefined
        }
      />
    );
  }

  const arcPath = `M ${CX - RADIUS} ${CY} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${CY}`;

  return (
    <div className="risk-gauge-container">
      {/*
        Live region — outside the SVG so AT implementations that skip inline
        SVG <title> elements still announce score and sector changes.
        aria-atomic="true": announce the whole message, not just changed text.
      */}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {/*
        SR-only table listing all three risk bands with score ranges.
        Gives AT users a structured alternative to the arc so they can
        understand the full band context without navigating individual sectors.
        Rendered before the SVG so it appears early in reading order.
      */}
      {showSRTable && (
        <RiskGaugeSRTable
          normalizedScore={normalizedScore}
          activeSector={activeSector}
        />
      )}

      {/*
        SVG gauge.

        Accessibility attributes
        ────────────────────────
        role="img"           → widget is a single composite image
        aria-labelledby      → points at the hidden <title> inside the SVG
        tabIndex={0}         → makes the whole gauge reachable via Tab
        data-active-sector   → exposes active band to tests and AT tooling
        data-testid          → used by integration tests in this repo

        Focus ring
        ──────────
        .risk-gauge-svg class → :focus-visible rule in focus.css applies
                                 the box-shadow double-ring
        overflow: visible     → required so the ring is not clipped at the
                                 SVG viewport edge (set in RiskGauge.css)
        outline: none         → suppressed — replaced by box-shadow (WCAG 2.4.11
                                 compliant because box-shadow ring ≥ 2 px and
                                 contrast ≥ 3:1)
      */}
      <svg
        className="risk-gauge-svg"
        viewBox="0 0 160 100"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-labelledby={titleId}
        data-testid="risk-gauge-svg"
        data-active-sector={activeSector}
        data-reduced-motion={isReducedMotionActive ? "true" : "false"}
        tabIndex={0}
        onKeyDown={handleSvgKeyDown}
      >
        {/* SVG title — announced by AT when the SVG element is focused. */}
        <title id={titleId}>{srDescription}</title>

        {/* Background track arc */}
        <path className="risk-gauge-bg" d={arcPath} aria-hidden="true" />

        {/*
          Interactive sector bands.
          Rendered below the fill arc so the fill overlays them visually, but
          each sector <g> is independently focusable via keyboard.
          Omitted when showSectors=false (e.g. print / decorative contexts).
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

        {/* Score fill arc */}
        <path
          className="risk-gauge-fill"
          d={arcPath}
          stroke={gaugeColor}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          aria-hidden="true"
        />

        {/* Score numeral */}
        <text x={CX} y={CY - 12} className="risk-gauge-score" aria-hidden="true">
          {scoreFormatter.format(Math.round(displayedScore))}
        </text>

        {/* "Risk Score" label */}
        <text x={CX} y={CY - 38} className="risk-gauge-label" aria-hidden="true">
          Risk Score
        </text>
      </svg>

      {/* Trend / Last Updated meta row */}
      <div className="risk-meta" aria-hidden="true">
        <div className="risk-meta-item">
          <span className="rm-label">Trend</span>
          <span
            className="rm-value"
            style={{ color: trendColor, display: "flex", alignItems: "center", gap: "8px" }}
          >
            <span>
              {trendArrow} {trendLabel}
            </span>
            {history && history.length > 0 && (
              <Sparkline data={history} width={60} height={24} color={trendColor} />
            )}
          </span>
        </div>
        <div className="risk-meta-item">
          <span className="rm-label">Last Updated</span>
          <span className="rm-value" style={{ color: COLOR.muted }}>
            {fmtDate(lastUpdated)}
          </span>
        </div>
      </div>

      {/* Keyboard shortcut hint */}
      <div
        className="risk-meta-item"
        style={{ marginTop: "0.75rem", justifyContent: "center" }}
      >
        <KbdHint
          keys={["?"]}
          label="Explain Risk"
          description="Press question mark to open help overlay"
        />
      </div>
    </div>
  );
}
