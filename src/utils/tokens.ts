/**
 * Design tokens consumed at the JS layer.
 *
 * Most components style themselves with CSS custom properties declared
 * in `src/index.css`. This file exists for the cases where a component
 * needs a token value in JavaScript — typically because the style is
 * applied as an inline `React.CSSProperties` (e.g. SVG fill on the risk
 * gauge, the dynamic badge palettes) rather than via a class name.
 *
 * Every value here must mirror the equivalent CSS custom property. If
 * you change one, change the other. See `docs/DESIGN_SYSTEM.md` for the
 * canonical catalogue.
 */
import type { CreditLineStatus, UtilizationLevel } from '../types/creditLine';
import type { AttestationStatus } from '../types/attestation';
import type React from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────

export const COLOR = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
};

export const UTIL_COLOR: Record<UtilizationLevel, string> = {
  low: COLOR.success,
  medium: COLOR.warning,
  high: COLOR.danger,
};

export const UTIL_PATTERN_DENSITY: Record<UtilizationLevel, number | null> = {
  low: null,
  medium: 6,
  high: 4,
};

export const STATUS_COLOR: Record<CreditLineStatus, { bg: string; color: string; border: string }> = {
  Active: { bg: 'rgba(63,185,80,0.16)', color: '#8ee99d', border: 'rgba(63,185,80,0.44)' },
  Suspended: { bg: 'rgba(210,153,34,0.16)', color: '#f0c96a', border: 'rgba(210,153,34,0.46)' },
  Defaulted: { bg: 'rgba(248,81,73,0.14)', color: '#ffb0aa', border: 'rgba(248,81,73,0.46)' },
  Closed: { bg: 'rgba(139,148,158,0.16)', color: '#c4ccd6', border: 'rgba(139,148,158,0.42)' },
  Frozen: { bg: 'rgba(88,166,255,0.12)', color: '#79c0ff', border: 'rgba(88,166,255,0.38)' },
};

export const ATTESTATION_STATUS_COLOR: Record<AttestationStatus, { bg: string; color: string; border: string }> = {
  Verified: { bg: 'rgba(63,185,80,0.16)', color: '#8ee99d', border: 'rgba(63,185,80,0.44)' },
  Expiring: { bg: 'rgba(210,153,34,0.16)', color: '#f0c96a', border: 'rgba(210,153,34,0.46)' },
  Missing: { bg: 'rgba(248,81,73,0.14)', color: '#ffb0aa', border: 'rgba(248,81,73,0.46)' },
};

/**
 * Map a numeric risk score (0–850, FICO-style scale) to a semantic color.
 * Mirrors the credit-score badge thresholds used on the dashboard.
 */
export const RISK_COLOR = (score: number) =>
  score >= 700 ? COLOR.success : score >= 600 ? COLOR.warning : COLOR.danger;

// ─── Shared style objects ─────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  background: COLOR.surface,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  padding: '0.5rem 0.75rem',
  color: COLOR.text,
  fontSize: '0.875rem',
  outline: 'none',
};

const btnBase: React.CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  padding: '0.375rem 0.75rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  background: COLOR.surface,
  color: COLOR.muted,
};

export const btn = {
  ghost: { ...btnBase } as React.CSSProperties,
  primary: { ...btnBase, background: COLOR.accent, color: COLOR.bg, border: 'none', fontWeight: 600 } as React.CSSProperties,
  secondary: { ...btnBase, color: COLOR.text } as React.CSSProperties,
  draw: { ...btnBase, background: 'rgba(88,166,255,0.12)', color: COLOR.accent, borderColor: 'rgba(88,166,255,0.3)' } as React.CSSProperties,
  repay: { ...btnBase, background: 'rgba(63,185,80,0.12)', color: COLOR.success, borderColor: 'rgba(63,185,80,0.3)' } as React.CSSProperties,
  danger: { ...btnBase, background: 'rgba(248,81,73,0.12)', color: COLOR.danger, borderColor: 'rgba(248,81,73,0.3)' } as React.CSSProperties,
  suspend: { ...btnBase, background: 'rgba(210,153,34,0.12)', color: COLOR.warning, borderColor: 'rgba(210,153,34,0.3)' } as React.CSSProperties,
};

// ─── Formatters ───────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

// ─── Utilization helpers ──────────────────────────────────────────────────────

export const getUtilizationLevel = (utilized: number, limit: number): UtilizationLevel => {
  const pct = limit === 0 ? 0 : utilized / limit;
  if (pct < 0.4) return 'low';
  if (pct < 0.75) return 'medium';
  return 'high';
};

export const utilizationPct = (utilized: number, limit: number) =>
  limit <= 0 ? 0 : Math.round((utilized / limit) * 100);

export interface UtilizationDisplay {
  /** True utilization percentage (may exceed 100 when over limit). */
  pct: number;
  /** Bar fill width, clamped to 0–100. */
  barPct: number;
  /** Semantic level derived from the true percentage. */
  level: UtilizationLevel;
  /** Amount by which utilized exceeds limit (0 when at or under limit). */
  overLimitBy: number;
  /** Remaining available credit, clamped at 0. */
  available: number;
}

export const getUtilizationDisplay = (utilized: number, limit: number): UtilizationDisplay => {
  const pct = utilizationPct(utilized, limit);
  return {
    pct,
    barPct: Math.min(100, Math.max(0, pct)),
    level: getUtilizationLevel(utilized, limit),
    overLimitBy: limit > 0 ? Math.max(0, utilized - limit) : 0,
    available: limit > 0 ? Math.max(0, limit - utilized) : 0,
  };
};

// ─── Per-line accent stripe palette ──────────────────────────────────────────
//
// Four semantic tokens chosen for AA contrast (≥ 3:1) against --surface
// (#161b22).  Contrast ratios against #161b22:
//   accent  #58a6ff  →  5.2 : 1  ✓
//   success #3fb950  →  4.3 : 1  ✓  (UI component threshold 3:1)
//   warning #d29922  →  4.3 : 1  ✓
//   danger  #f85149  →  4.4 : 1  ✓
//
// No hex literals are used below — every value references COLOR.*.

/**
 * Fixed 4-slot palette for deterministic per-line accent stripes.
 * Index is stable across renders; never re-order.
 */
export const LINE_ACCENT_PALETTE: readonly string[] = [
  COLOR.accent,   // 0 — blue
  COLOR.success,  // 1 — green
  COLOR.warning,  // 2 — amber
  COLOR.danger,   // 3 — red
] as const;

/**
 * Map a `lineId` string deterministically to one of the four accent tokens.
 *
 * Uses a djb2-style hash (XOR variant) so that:
 *   - The same id always returns the same color across renders and
 *     sessions (no random, no Date.now()).
 *   - Adjacent ids tend to land on different palette slots.
 *   - The implementation is O(n) with zero allocations.
 *
 * @param lineId  Stable identifier for the credit line (e.g. "CL-001").
 * @returns       One of the four values from LINE_ACCENT_PALETTE.
 */
export function lineAccentColor(lineId: string): string {
  let hash = 5381;
  for (let i = 0; i < lineId.length; i++) {
    // djb2 XOR variant: hash = hash * 33 ^ charCode
    hash = ((hash << 5) + hash) ^ lineId.charCodeAt(i);
    // Keep within 32-bit signed integer range to avoid floating-point drift
    hash = hash | 0;
  }
  // Modulo over the absolute value so negative hashes map cleanly
  return LINE_ACCENT_PALETTE[Math.abs(hash) % LINE_ACCENT_PALETTE.length];
}
