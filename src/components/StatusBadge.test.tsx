import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';
import { STATUS_COLOR } from '../utils/tokens';
import type { CreditLineStatus } from '../types/creditLine';

const STATUSES: CreditLineStatus[] = ['Active', 'Suspended', 'Defaulted', 'Closed'];
const SURFACE = '#161b22';

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function parseRgba(value: string): [number, number, number, number] {
  const match = value.match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/);
  if (!match) throw new Error(`Unsupported color: ${value}`);
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ];
}

function compositeOverSurface(rgba: string): [number, number, number] {
  const [r, g, b, alpha] = parseRgba(rgba);
  const [sr, sg, sb] = hexToRgb(SURFACE);
  return [
    Math.round((r * alpha) + (sr * (1 - alpha))),
    Math.round((g * alpha) + (sg * (1 - alpha))),
    Math.round((b * alpha) + (sb * (1 - alpha))),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (0.2126 * rs) + (0.7152 * gs) + (0.0722 * bs);
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLum = relativeLuminance(hexToRgb(foreground));
  const backgroundLum = relativeLuminance(compositeOverSurface(background));
  const lighter = Math.max(foregroundLum, backgroundLum);
  const darker = Math.min(foregroundLum, backgroundLum);

  return (lighter + 0.05) / (darker + 0.05);
}

describe('StatusBadge', () => {
  it('announces the credit line status and renders a non-color cue', () => {
    render(<StatusBadge status="Defaulted" />);

    expect(screen.getByLabelText('Credit line status: Defaulted')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('renders correctly in icon-only mode with a tooltip', () => {
    render(<StatusBadge status="Defaulted" iconOnly />);

    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.queryByText('Defaulted')).not.toBeInTheDocument();
    // Tooltip renders with aria-hidden until hovered, so we check using hidden: true
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent('Status: Defaulted');
  });

  it('keeps each status foreground at WCAG AA contrast against its tint', () => {
    for (const status of STATUSES) {
      const { color, bg } = STATUS_COLOR[status];

      expect(contrastRatio(color, bg), status).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('StatusBadge reduced-motion', () => {
  const cssPath = resolve(__dirname, 'StatusBadge.css');

  it('defines @keyframes status-badge-pulse in CSS', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('@keyframes status-badge-pulse');
  });

  it('suppresses animation under @media (prefers-reduced-motion: reduce)', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain('animation: none');
  });

  it('suppresses animation under [data-motion="reduced"]', () => {
    const css = readFileSync(cssPath, 'utf-8');
    expect(css).toContain('[data-motion="reduced"]');
    expect(css).toContain('animation: none');
  });
});
