import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * Token-pinned colours for repayment feedback banners.
 *
 * All border/bg/color values reference CSS custom properties defined in
 * src/index.css so dark-mode and theming changes only happen in one place.
 * Each severity also carries a `patternClass` that adds a CSS pattern texture
 * (see src/styles/patterns.css) so severity is conveyed by shape AND colour,
 * satisfying WCAG 1.4.1 (Use of Color).
 */
export const SEVERITY_CONFIG = {
  info: {
    border: 'var(--accent-border)',
    bg: 'var(--accent-tint)',
    color: 'var(--accent)',
    patternClass: 'rp-severity--info',
    icon: <Info size={16} aria-hidden="true" />,
  },
  success: {
    border: 'var(--success-border)',
    bg: 'var(--success-tint)',
    color: 'var(--success)',
    patternClass: 'rp-severity--success',
    icon: <CheckCircle size={16} aria-hidden="true" />,
  },
  warning: {
    border: 'var(--warning-border)',
    bg: 'var(--warning-tint)',
    color: 'var(--warning)',
    patternClass: 'rp-severity--warning',
    icon: <AlertTriangle size={16} aria-hidden="true" />,
  },
  danger: {
    border: 'var(--error-border)',
    bg: 'var(--error-tint)',
    color: 'var(--error)',
    patternClass: 'rp-severity--danger',
    icon: <AlertCircle size={16} aria-hidden="true" />,
  },
} as const;

export type RepaySeverity = keyof typeof SEVERITY_CONFIG;
export type SeverityStyle = (typeof SEVERITY_CONFIG)[RepaySeverity];
