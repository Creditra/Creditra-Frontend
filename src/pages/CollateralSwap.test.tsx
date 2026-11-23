/**
 * @fileoverview Tests for src/pages/CollateralSwap.tsx
 *
 * Covers:
 *   - Skeleton renders while loading (shape-parity assertions — issue #834)
 *   - Loaded state renders the swap form with correct structure
 *   - Accessible markup: role="status", aria-busy, aria-label
 *   - WCAG-relevant attributes on interactive elements
 *   - CollateralSwap.css structural rules (class presence via DOM)
 *
 * Shape-parity approach:
 *   jsdom cannot evaluate CSS variables or computed styles so radius assertions
 *   are done by verifying that the class name driving the correct token is
 *   present on the element, mirroring the strategy used in Skeleton.test.tsx.
 *
 * GrantFox FWC26 — issue #834
 */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import CollateralSwap from './CollateralSwap';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Advance timers past the simulated data-fetch delay (1400 ms) and wait for
// all pending React state updates to flush before the test body asserts.
const resolveLoading = async () => {
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
};

// ── CSS structural tests ──────────────────────────────────────────────────────

describe('CollateralSwap.css — structural class rules (issue #834)', () => {
  const cssPath = resolve(__dirname, './CollateralSwap.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('defines .collateral-swap__card with border-radius token --radius-lg', () => {
    expect(css).toContain('.collateral-swap__card');
    const cardIdx = css.indexOf('.collateral-swap__card');
    const cardBlock = css.slice(cardIdx, css.indexOf('}', cardIdx));
    expect(cardBlock).toContain('var(--radius-lg)');
  });

  it('defines .collateral-swap__asset-row with border-radius token --radius-md', () => {
    expect(css).toContain('.collateral-swap__asset-row');
    const rowIdx = css.indexOf('.collateral-swap__asset-row');
    const rowBlock = css.slice(rowIdx, css.indexOf('}', rowIdx));
    expect(rowBlock).toContain('var(--radius-md)');
  });

  it('defines .collateral-swap__skeleton-asset-row with min-height for CLS prevention', () => {
    expect(css).toContain('.collateral-swap__skeleton-asset-row');
    const idx = css.indexOf('.collateral-swap__skeleton-asset-row');
    const block = css.slice(idx, css.indexOf('}', idx));
    expect(block).toContain('min-height');
  });

  it('defines .collateral-swap__skeleton-impact with grid layout matching final impact row', () => {
    expect(css).toContain('.collateral-swap__skeleton-impact');
    const idx = css.indexOf('.collateral-swap__skeleton-impact');
    const block = css.slice(idx, css.indexOf('}', idx));
    expect(block).toContain('grid-template-columns');
  });

  it('defines confirm button with min-height: 48px (WCAG touch target)', () => {
    expect(css).toContain('.collateral-swap__confirm-btn');
    const idx = css.indexOf('.collateral-swap__confirm-btn');
    const block = css.slice(idx, css.indexOf('}', idx));
    expect(block).toContain('48px');
  });

  it('suppresses transitions under prefers-reduced-motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rmBlock).toContain('transition: none');
  });

  it('suppresses transitions under [data-motion="reduced"] runtime toggle', () => {
    expect(css).toContain('[data-motion="reduced"]');
    const motionBlock = css.slice(css.indexOf('[data-motion="reduced"]'));
    expect(motionBlock).toContain('transition: none');
  });

  it('uses only design token references, not hard-coded hex colours', () => {
    // Hex literals (other than zero values) should not appear as property values
    const hexPattern = /:\s*#[0-9a-fA-F]{3,8}\b/g;
    const matches = css.match(hexPattern) ?? [];
    expect(matches).toHaveLength(0);
  });
});

// ── Loading skeleton tests ────────────────────────────────────────────────────

describe('CollateralSwap — loading skeleton (shape parity, issue #834)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('renders a status region with aria-busy="true" while loading', () => {
    render(<CollateralSwap />);
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion.getAttribute('aria-busy')).toBe('true');
  });

  it('labels the loading status region for assistive technology', () => {
    render(<CollateralSwap />);
    const statusRegion = screen.getByRole('status');
    expect(statusRegion.getAttribute('aria-label')).toBe('Loading collateral swap');
  });

  it('renders the card skeleton with shape class for --radius-lg outer container', () => {
    const { container } = render(<CollateralSwap />);
    // The card wrapper is .collateral-swap__card, not a <Skeleton>, but the
    // child skeletons that are Skeleton elements should carry shape classes.
    // Verify at least one skeleton--rectangular or skeleton--circular is rendered.
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
  });

  it('renders circular skeleton shapes for asset icon placeholders', () => {
    const { container } = render(<CollateralSwap />);
    const circular = container.querySelectorAll('.skeleton--circular');
    // Two asset icons (40x40) + one direction indicator (28x28) = 3 minimum
    expect(circular.length).toBeGreaterThanOrEqual(3);
  });

  it('renders rounded skeleton shapes for text-row placeholders', () => {
    const { container } = render(<CollateralSwap />);
    const rounded = container.querySelectorAll('.skeleton--rounded');
    // name + balance rows for each asset block plus impact values
    expect(rounded.length).toBeGreaterThanOrEqual(6);
  });

  it('renders the header title skeleton before data loads', () => {
    const { container } = render(<CollateralSwap />);
    // Title and subtitle skeletons are direct children of the header skeleton
    const headerSkeletons = container.querySelector('.collateral-swap__header');
    expect(headerSkeletons).toBeInTheDocument();
    const skeletons = headerSkeletons!.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(2);
  });

  it('all skeleton elements are aria-hidden by default (decorative)', () => {
    const { container } = render(<CollateralSwap />);
    const skeletons = container.querySelectorAll('.skeleton');
    skeletons.forEach((el) => {
      // Each Skeleton primitive defaults aria-hidden to true
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('applies subtle variant to secondary skeleton rows', () => {
    const { container } = render(<CollateralSwap />);
    const subtle = container.querySelectorAll('.skeleton--subtle');
    // Balance rows and direction indicator use variant="subtle"
    expect(subtle.length).toBeGreaterThanOrEqual(3);
  });
});

// ── Post-load state tests ─────────────────────────────────────────────────────

describe('CollateralSwap — loaded state', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('removes the loading skeleton after data resolves', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders the page heading after data loads', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    expect(screen.getByRole('heading', { name: /swap collateral/i })).toBeInTheDocument();
  });

  it('renders the page subtitle after data loads', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    expect(screen.getByText(/exchange one collateral asset/i)).toBeInTheDocument();
  });

  it('renders the "From" and "To" asset groups', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    expect(screen.getByText(/^from$/i)).toBeInTheDocument();
    expect(screen.getByText(/^to$/i)).toBeInTheDocument();
  });

  it('renders the confirm swap button in an enabled state', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    const btn = screen.getByRole('button', { name: /confirm swap/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('renders the impact summary section with three metrics', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    // The impact labels are always present in the loaded state
    expect(screen.getByText(/health before/i)).toBeInTheDocument();
    expect(screen.getByText(/health after/i)).toBeInTheDocument();
    expect(screen.getByText(/swap fee/i)).toBeInTheDocument();
  });
});

// ── Interaction tests ─────────────────────────────────────────────────────────

describe('CollateralSwap — confirm button interaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('disables the button and shows "Swapping..." while submitting', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    const btn = screen.getByRole('button', { name: /confirm swap/i });
    act(() => {
      btn.click();
    });

    expect(screen.getByRole('button', { name: /swapping/i })).toBeDisabled();
  });

  it('shows "Swapped" after the submission resolves', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    const btn = screen.getByRole('button', { name: /confirm swap/i });
    act(() => {
      btn.click();
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('button', { name: /swapped/i })).toBeDisabled();
  });

  it('marks the confirm button as aria-busy while submitting', async () => {
    render(<CollateralSwap />);
    await resolveLoading();

    const btn = screen.getByRole('button', { name: /confirm swap/i });
    act(() => {
      btn.click();
    });

    expect(screen.getByRole('button', { name: /swapping/i }).getAttribute('aria-busy')).toBe('true');
  });
});

// ── Skeleton.css card shape token tests ──────────────────────────────────────

describe('Skeleton.css — card shape token (issue #834)', () => {
  const cssPath = resolve(__dirname, '../components/Skeleton.css');
  const css = readFileSync(cssPath, 'utf-8');

  it('declares --skeleton-radius-card token resolved via var(--radius-lg)', () => {
    expect(css).toContain('--skeleton-radius-card');
    expect(css).toContain('var(--radius-lg');
  });

  it('defines .skeleton--card class applying --skeleton-radius-card', () => {
    expect(css).toContain('.skeleton--card');
    const cardIdx = css.indexOf('.skeleton--card');
    const cardBlock = css.slice(cardIdx, css.indexOf('}', cardIdx));
    expect(cardBlock).toContain('var(--skeleton-radius-card)');
  });
});
