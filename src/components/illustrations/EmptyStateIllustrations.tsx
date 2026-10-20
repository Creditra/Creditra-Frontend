import type { ComponentPropsWithoutRef } from 'react';
import './EmptyStateIllustrations.css';

type IllustrationProps = ComponentPropsWithoutRef<'div'>;

/**
 * Shared empty-state illustrations for the main product surfaces.
 *
 * All SVG shapes intentionally use `currentColor` only so the artwork can
 * inherit the surrounding theme without maintaining a separate palette.
 * The illustrations are decorative; headings and body copy provide the
 * accessible name for each empty state.
 */
function IllustrationFrame({ className = '', children, ...props }: IllustrationProps) {
  const mergedClassName = ['empty-state-illustration', className].filter(Boolean).join(' ');

  return (
    <div className={mergedClassName} aria-hidden="true" {...props}>
      {children}
    </div>
  );
}

export function NoDataGraph(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        <rect x="18" y="18" width="144" height="104" rx="18" stroke="currentColor" strokeWidth="2" opacity="0.24" />
        <path d="M38 96H142" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.32" />
        <path d="M50 82L72 66L92 76L116 48L132 58" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="50" cy="82" r="4" fill="currentColor" />
        <circle cx="72" cy="66" r="4" fill="currentColor" />
        <circle cx="92" cy="76" r="4" fill="currentColor" opacity="0.72" />
        <circle cx="116" cy="48" r="4" fill="currentColor" />
        <circle cx="132" cy="58" r="4" fill="currentColor" opacity="0.72" />
        <path d="M54 108V92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.38" />
        <path d="M78 108V86" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.52" />
        <path d="M102 108V94" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.28" />
        <path d="M126 108V74" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.68" />
      </svg>
    </IllustrationFrame>
  );
}

export function NoLines(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        <rect x="22" y="28" width="136" height="84" rx="16" stroke="currentColor" strokeWidth="2" opacity="0.24" />
        <rect x="36" y="42" width="108" height="56" rx="12" stroke="currentColor" strokeWidth="2" opacity="0.38" />
        <path d="M42 58H138" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.16" />
        <path d="M52 78H92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.72" />
        <path d="M102 78H128" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.26" />
        <circle cx="132" cy="78" r="6" stroke="currentColor" strokeWidth="2" opacity="0.56" />
        <path d="M132 72V84" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.56" />
        <path d="M126 78H138" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.56" />
        <path d="M48 22L62 36" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
        <path d="M132 104L146 118" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      </svg>
    </IllustrationFrame>
  );
}

export function NoActivity(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        <rect x="18" y="20" width="144" height="100" rx="18" stroke="currentColor" strokeWidth="2" opacity="0.24" />
        <path d="M46 48H110" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.16" />
        <path d="M46 68H134" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.18" />
        <path d="M46 88H96" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.16" />
        <circle cx="124" cy="48" r="18" stroke="currentColor" strokeWidth="2" opacity="0.72" />
        <path d="M124 38V48L131 55" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M56 108C63 97 73 90 86 90C99 90 109 97 116 108" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
        <circle cx="86" cy="79" r="8" stroke="currentColor" strokeWidth="2" opacity="0.56" />
      </svg>
    </IllustrationFrame>
  );
}

/**
 * NoOutstandingDebt — illustrated empty state for the Repay flow.
 *
 * Composition: a stylised receipt/invoice with a $0 amount, paired with a
 * checkmark badge in the corner. Reinforces the "nothing to repay" message
 * without leaning on colour alone (the receipt shape + checkmark glyph are
 * widely understood).
 *
 * Inherits `--accent` (or any other surrounding foreground) via `currentColor`
 * so it stays consistent with light, dark, and high-contrast themes.
 */
/**
 * NoRiskGauge — illustrated empty state for the RiskGauge page.
 *
 * Composition: a dashed semicircular gauge arc (to hint at the real gauge
 * that will appear once data is available) with a question-mark glyph inside
 * the arc. The dashed line and low-opacity "?" visually communicate "not yet
 * populated" without relying on colour alone.
 *
 * Inherits `--accent` (or any other surrounding foreground) via `currentColor`
 * so it stays consistent with light, dark, and high-contrast themes.
 */
export function NoRiskGauge(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        {/* background card */}
        <rect x="16" y="16" width="148" height="108" rx="18" stroke="currentColor" strokeWidth="2" opacity="0.20" />
        {/* inner gauge surface hint — adds depth to the card */}
        <path d="M 36 92 A 54 54 0 0 1 144 92" stroke="currentColor" strokeWidth="1" opacity="0.08" />
        {/* dashed semicircular gauge arc (outer track) */}
        <path
          d="M 42 92 A 48 48 0 0 1 138 92"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="6 6"
          opacity="0.45"
        />
        {/* inner solid track — subtle concentric depth */}
        <path d="M 48 92 A 42 42 0 0 1 132 92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
        {/* tick marks along the arc */}
        <path d="M 52 78 L 56 74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.30" />
        <path d="M 72 66 L 76 62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.30" />
        <path d="M 90 60 L 90 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.30" />
        <path d="M 108 66 L 104 62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.30" />
        <path d="M 128 78 L 124 74" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.30" />
        {/* gauge needle resting at zero — reinforces "awaiting data" */}
        <line x1="90" y1="92" x2="50" y2="80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
        <circle cx="90" cy="92" r="3.5" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        {/* "?" mark in the centre — communicates "no data yet" */}
        <text
          x="90"
          y="82"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="currentColor"
          opacity="0.28"
        >
          ?
        </text>
        {/* label hint below the gauge */}
        <text
          x="90"
          y="112"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="9"
          fontWeight="600"
          fill="currentColor"
          opacity="0.32"
          letterSpacing="0.12em"
        >
          RISK SCORE
        </text>
      </svg>
    </IllustrationFrame>
  );
}

/**
 * NoOverdue — illustrated empty state for the AgingTag page.
 *
 * Composition: a stylised calendar page with a green checkmark badge,
 * communicating that no credit lines are past due. The calendar motif
 * was chosen because "aging" is inherently a time-based concept; the
 * checkmark reinforces the positive "all current" message.
 *
 * Inherits `--accent` (or any other surrounding foreground) via `currentColor`
 * so it stays consistent with light, dark, and high-contrast themes.
 */
export function NoOverdue(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        {/* calendar body */}
        <rect x="24" y="26" width="132" height="100" rx="16" stroke="currentColor" strokeWidth="2" opacity="0.24" />
        {/* calendar header bar */}
        <path d="M24 42h132" stroke="currentColor" strokeWidth="2" opacity="0.12" />
        {/* calendar page corners — hint of page curl */}
        <path d="M140 126h-8v-8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.15" />
        {/* date grid dashes */}
        <path d="M38 58h30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.18" />
        <path d="M38 72h104" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.14" />
        <path d="M38 86h80" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.14" />
        <path d="M38 100h56" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.10" />
        {/* clock icon hint on the right */}
        <circle cx="138" cy="76" r="14" stroke="currentColor" strokeWidth="2" opacity="0.30" />
        <path d="M138 68v8l5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.30" />
        {/* large checkmark badge — the hero element */}
        <circle cx="64" cy="108" r="20" stroke="currentColor" strokeWidth="2" opacity="0.85" />
        <circle cx="64" cy="108" r="16" stroke="currentColor" strokeWidth="1" opacity="0.24" />
        <path d="M56 108l5 5 11-11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IllustrationFrame>
  );
}

export function NoOutstandingDebt(props: IllustrationProps) {
  return (
    <IllustrationFrame {...props}>
      <svg viewBox="0 0 180 140" fill="none" focusable="false">
        {/* receipt outline */}
        <path
          d="M48 18h84a6 6 0 0 1 6 6v92l-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6-8 6-8-6V24a6 6 0 0 1 6-6Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.42"
        />
        {/* receipt header rule */}
        <path d="M62 36H118" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.38" />
        {/* $0 amount line */}
        <text
          x="90"
          y="74"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="28"
          fontWeight="700"
          fill="currentColor"
          opacity="0.85"
        >
          $0
        </text>
        {/* lower receipt rule */}
        <path d="M62 92H118" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.28" />
        {/* paid stamp / checkmark badge */}
        <circle cx="128" cy="38" r="20" stroke="currentColor" strokeWidth="2" opacity="0.85" />
        <path d="M120 38L126 44L137 32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IllustrationFrame>
  );
}
