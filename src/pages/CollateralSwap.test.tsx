/**
 * @fileoverview Tests for src/pages/CollateralSwap.tsx
 *
 * Covers:
 *   - Skeleton renders while credit lines are loading (shape-parity assertions — issue #834)
 *   - Error state when credit-line fetch fails
 *   - Empty state when no credit line has collateral
 *   - Real credit-line selection, from/to asset derivation, and live LTV + fee calculation
 *   - Unsafe swaps pushing LTV over liquidation threshold are blocked with accessible alert
 *   - Stale quote expiry and refresh flow
 *   - Slippage tolerance preset selection
 *   - Handoff to CollateralSubstitutionModal on confirm
 *   - CollateralSwap.css & Skeleton.css structural rules
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import CollateralSwap from './CollateralSwap';
import { useCreditLines, type UseCreditLinesResult } from '../hooks/useCreditLines';
import type { CreditLine } from '../types/creditLine';
import {
  AVAILABLE_COLLATERAL_ASSETS,
  computeLtvSnapshot,
  computeSubstitutionFee,
  fmtLtv,
  STALE_QUOTE_THRESHOLD_MS,
} from '../utils/collateral';

vi.mock('../hooks/useCreditLines', () => ({
  useCreditLines: vi.fn(),
}));

const mockedUseCreditLines = vi.mocked(useCreditLines);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LINE_WITH_USDC: CreditLine = {
  id: 'cl-usdc',
  name: 'Treasury Line',
  status: 'Active',
  limit: 400_000,
  utilized: 200_000,
  apr: 7.5,
  riskScore: 750,
  collateral: 'USDC Treasury',
  openedAt: '2025-01-15',
  updatedAt: '2025-02-20T10:00:00Z',
  transactions: [],
  statusHistory: [],
};

const LINE_WITH_REAL_ESTATE: CreditLine = {
  id: 'cl-re',
  name: 'Commercial Line',
  status: 'Active',
  limit: 800_000,
  utilized: 250_000,
  apr: 8.5,
  riskScore: 720,
  collateral: 'Commercial Real Estate',
  openedAt: '2024-03-15',
  updatedAt: '2025-02-20T14:32:00Z',
  transactions: [],
  statusHistory: [],
};

const LINE_WITHOUT_COLLATERAL: CreditLine = {
  id: 'cl-unsecured',
  name: 'Unsecured Builder Line',
  status: 'Active',
  limit: 50_000,
  utilized: 10_000,
  apr: 11.0,
  riskScore: 700,
  openedAt: '2025-01-01',
  updatedAt: '2025-02-01T10:00:00Z',
  transactions: [],
  statusHistory: [],
};

function makeCreditLinesResult(
  overrides: Partial<UseCreditLinesResult> = {},
): UseCreditLinesResult {
  return {
    status: 'success',
    lines: [LINE_WITH_USDC, LINE_WITH_REAL_ESTATE],
    error: null,
    refetch: vi.fn().mockResolvedValue([]),
    lastUpdatedAt: new Date(),
    owner: 'GABC',
    wallet: null,
    setLines: vi.fn(),
    ...overrides,
  };
}

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
    const hexPattern = /:\s*#[0-9a-fA-F]{3,8}\b/g;
    const matches = css.match(hexPattern) ?? [];
    expect(matches).toHaveLength(0);
  });
});

// ── Loading skeleton tests ────────────────────────────────────────────────────

describe('CollateralSwap — loading skeleton (shape parity, issue #834)', () => {
  beforeEach(() => {
    mockedUseCreditLines.mockReturnValue(
      makeCreditLinesResult({ status: 'loading', lines: [] }),
    );
  });

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

  it('renders the card skeleton with shape classes and decorative aria-hidden', () => {
    const { container } = render(<CollateralSwap />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll('.skeleton--circular').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('.skeleton--rounded').length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll('.skeleton--subtle').length).toBeGreaterThanOrEqual(3);
    skeletons.forEach((el) => {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    });
  });
});

// ── Error & Empty states ──────────────────────────────────────────────────────

describe('CollateralSwap — error and empty states', () => {
  it('renders an accessible error state and retries when clicked', () => {
    const refetch = vi.fn().mockResolvedValue([]);
    mockedUseCreditLines.mockReturnValue(
      makeCreditLinesResult({
        status: 'error',
        lines: [],
        error: new Error('Network unreachable'),
        refetch,
      }),
    );

    render(<CollateralSwap />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/network unreachable/i);

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders EmptyState when no credit line has collateral', () => {
    mockedUseCreditLines.mockReturnValue(
      makeCreditLinesResult({
        status: 'success',
        lines: [LINE_WITHOUT_COLLATERAL],
      }),
    );

    render(<CollateralSwap />);
    expect(screen.getByTestId('collateral-swap-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no collateralized credit lines/i)).toBeInTheDocument();
  });
});

// ── Loaded state & quote engine calculations ──────────────────────────────────

describe('CollateralSwap — real credit lines and quote engine', () => {
  beforeEach(() => {
    mockedUseCreditLines.mockReturnValue(makeCreditLinesResult());
  });

  it('derives the From asset from the selected credit line and computes real LTV and fee', () => {
    render(<CollateralSwap />);

    expect(screen.getByRole('heading', { name: /swap collateral/i })).toBeInTheDocument();

    const usdc = AVAILABLE_COLLATERAL_ASSETS.find((a) => a.id === 'asset-usdc')!;
    const xlm = AVAILABLE_COLLATERAL_ASSETS.find((a) => a.id === 'asset-xlm')!;
    const beforeSnap = computeLtvSnapshot(usdc, LINE_WITH_USDC.utilized);
    const afterSnap = computeLtvSnapshot(xlm, LINE_WITH_USDC.utilized);
    const expectedFee = computeSubstitutionFee(LINE_WITH_USDC.utilized, xlm);

    expect(screen.getByTestId('ltv-before')).toHaveTextContent(fmtLtv(beforeSnap.ltvRatio));
    expect(screen.getByTestId('ltv-after')).toHaveTextContent(fmtLtv(afterSnap.ltvRatio));
    expect(screen.getByTestId('swap-fee')).toHaveTextContent(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        expectedFee.total,
      ),
    );
  });

  it('recalculates LTV and fee when changing credit line, target asset, or amount', () => {
    render(<CollateralSwap />);

    // Change target asset to Commercial Real Estate (adds $250 appraisal fee)
    const toSelect = screen.getByLabelText(/target collateral asset/i);
    fireEvent.change(toSelect, { target: { value: 'asset-real-estate' } });

    const realEstate = AVAILABLE_COLLATERAL_ASSETS.find((a) => a.id === 'asset-real-estate')!;
    const feeWithAppraisal = computeSubstitutionFee(LINE_WITH_USDC.utilized, realEstate);
    expect(screen.getByTestId('swap-fee')).toHaveTextContent(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        feeWithAppraisal.total,
      ),
    );

    // Change credit line to Commercial Line
    const lineSelect = screen.getByLabelText(/credit line/i);
    fireEvent.change(lineSelect, { target: { value: LINE_WITH_REAL_ESTATE.id } });

    const reBefore = computeLtvSnapshot(realEstate, LINE_WITH_REAL_ESTATE.utilized);
    expect(screen.getByTestId('ltv-before')).toHaveTextContent(fmtLtv(reBefore.ltvRatio));

    // Change loan amount
    const amountInput = screen.getByLabelText(/loan balance/i);
    fireEvent.change(amountInput, { target: { value: '100000' } });
    const reUpdated = computeLtvSnapshot(realEstate, 100_000);
    expect(screen.getByTestId('ltv-before')).toHaveTextContent(fmtLtv(reUpdated.ltvRatio));
  });

  it('blocks unsafe swaps pushing post-swap LTV over the liquidation threshold', () => {
    render(<CollateralSwap />);

    // Target XLM has value 320,000 and maxLtvRatio 0.65 (max safe loan = 208,000).
    // Setting amount to 250,000 pushes LTV to 78.1% > 65%.
    const amountInput = screen.getByLabelText(/loan balance/i);
    fireEvent.change(amountInput, { target: { value: '250000' } });

    const alert = screen.getByTestId('over-ltv-alert');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/swap blocked/i);

    const confirmBtn = screen.getByRole('button', { name: /swap blocked/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('allows changing slippage tolerance presets', () => {
    render(<CollateralSwap />);

    const defaultChip = screen.getByRole('radio', { name: '1%' });
    const twoPctChip = screen.getByRole('radio', { name: '2%' });

    expect(defaultChip).toHaveAttribute('aria-checked', 'true');
    expect(twoPctChip).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(twoPctChip);
    expect(twoPctChip).toHaveAttribute('aria-checked', 'true');
    expect(defaultChip).toHaveAttribute('aria-checked', 'false');
  });

  it('hands off confirmation to CollateralSubstitutionModal when Confirm Swap is clicked', () => {
    render(<CollateralSwap />);

    const confirmBtn = screen.getByRole('button', { name: /confirm swap/i });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(confirmBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

// ── Stale quote expiry tests ──────────────────────────────────────────────────

describe('CollateralSwap — stale quote handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedUseCreditLines.mockReturnValue(makeCreditLinesResult());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks the quote stale after STALE_QUOTE_THRESHOLD_MS and allows refreshing', () => {
    render(<CollateralSwap />);

    expect(screen.queryByTestId('stale-quote-alert')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(STALE_QUOTE_THRESHOLD_MS + 100);
    });

    const staleAlert = screen.getByTestId('stale-quote-alert');
    expect(staleAlert).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: /quote expired/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /refresh quote/i }));

    expect(screen.queryByTestId('stale-quote-alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm swap/i })).not.toBeDisabled();
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
