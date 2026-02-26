import type { CreditLineStatus, UtilizationLevel } from '../types/creditLine';
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

export const STATUS_COLOR: Record<CreditLineStatus, { bg: string; color: string }> = {
  Active: { bg: 'rgba(63,185,80,0.2)', color: COLOR.success },
  Suspended: { bg: 'rgba(210,153,34,0.2)', color: COLOR.warning },
  Defaulted: { bg: 'rgba(248,81,73,0.15)', color: COLOR.danger },
  Closed: { bg: 'rgba(139,148,158,0.15)', color: COLOR.muted },
};

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

// ─── Utilization helpers ──────────────────────────────────────────────────────

export const getUtilizationLevel = (utilized: number, limit: number): UtilizationLevel => {
  const pct = utilized / limit;
  if (pct < 0.4) return 'low';
  if (pct < 0.75) return 'medium';
  return 'high';
};

export const utilizationPct = (utilized: number, limit: number) =>
  limit === 0 ? 0 : Math.round((utilized / limit) * 100);
