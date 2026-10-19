import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Local mock — this file is the empty-state suite, so we override the
// module with `vi.mock` (hoisted) right at the top. The populated suite in
// `RepayPage.test.tsx` is unaffected because they live in separate files.
vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [],
}));

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: [],
    refreshBalance: async () => [],
  }),
}));

import RepayPage from '../RepayPage';

function renderEmpty(initialEntries = ['/repay']) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

/**
 * Issue #581 — themed empty state on RepayPage.
 *
 * These tests verify the empty-state render path:
 *
 * - the new `<EmptyState />` is rendered with the success tone
 * - the `NoOutstandingDebt` illustration is decorative (aria-hidden)
 * - the helpful CTAs (Request a credit line + Back to dashboard) are present
 * - the region uses role="status" + aria-live="polite" + aria-labelledby
 * - the credit-line selection list collapses when no repayable lines exist
 *
 * The data mock is satisfied via a separate file so it never collides
 * with the populated suite (see comment in `RepayPage.test.tsx`).
 */
describe('RepayPage empty state (issue #581)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
  it('renders the themed empty state when no repayable lines exist', () => {
    renderEmpty();

    expect(
      screen.getByRole('heading', { name: 'Nothing to repay right now' }),
    ).toBeInTheDocument();
    // Match a description-unique fragment so the assertion stays specific
    // (independent of the apostrophe glyph used in the source string).
    expect(
      screen.getByText(/outstanding balance/i),
    ).toBeInTheDocument();
  });

  it('exposes primary CTA to /open-credit', () => {
    renderEmpty();

    const cta = screen.getByRole('link', { name: /request a credit line/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/open-credit');
  });

  it('exposes a secondary CTA back to the dashboard', () => {
    renderEmpty();

    const secondary = screen.getByRole('link', { name: /back to dashboard/i });
    expect(secondary).toBeInTheDocument();
    expect(secondary).toHaveAttribute('href', '/');
  });

  it('exposes the empty-state region with role=status and aria-live=polite', () => {
    renderEmpty();

    const region = screen.getByTestId('repay-empty-state');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-labelledby');
    const labelId = region.getAttribute('aria-labelledby');
    expect(document.getElementById(labelId!)).toHaveTextContent(
      'Nothing to repay right now',
    );
    expect(region).toHaveClass('empty-state--success');
  });

  it('renders the illustrative SVG and the accent eyebrow', () => {
    const { container } = renderEmpty();

    const illustration = container.querySelector('.empty-state-illustration');
    expect(illustration).not.toBeNull();
    expect(illustration?.getAttribute('aria-hidden')).toBe('true');

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('hides the credit-line list selection buttons in the empty state', () => {
    renderEmpty();

    // No credit-line selection buttons should be present.
    expect(
      screen.queryByRole('button', { name: /primary business line/i }),
    ).not.toBeInTheDocument();
    // The Back button (navigate(-1)) at the top of the page still exists.
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('preserves the Back button and the page header', () => {
    renderEmpty();

    // Page header eyebrow + title still rendered above the empty state.
    expect(screen.getByText('Repay Credit')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Select a credit line to repay' }),
    ).toBeInTheDocument();
  });
});

/**
 * Variant suite — same expectations when existing lines are all paid off
 * (utilized === 0). The page treats them as empty in `useMemo` so the
 * illustration path must still engage.
 */
describe('RepayPage empty state when all utilization is zero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
  it('renders the empty state when the only line has utilized === 0', async () => {
    // Override the mock for this single test by re-mocking the module via
    // dynamic import; the file-level mock keeps things tidy otherwise.
    vi.doMock('@/data/mockData', () => ({
      MOCK_CREDIT_LINES: [
        {
          id: 'CL-EMPTY-001',
          name: 'Paid Off Business Line',
          status: 'Active',
          limit: 100000,
          utilized: 0,
          apr: 7.5,
          riskScore: 800,
          openedAt: '2024-01-01',
          updatedAt: '2025-01-01T00:00:00Z',
          transactions: [],
          statusHistory: [],
        },
      ],
    }));
    vi.resetModules();
    const { default: FreshRepayPage } = await import('../RepayPage');

    render(
      <MemoryRouter initialEntries={['/repay']}>
        <FreshRepayPage />
      </MemoryRouter>,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByRole('heading', { name: 'Nothing to repay right now' }),
    ).toBeInTheDocument();

    // The paid-off line itself must not appear in the selection list.
    expect(screen.queryByText('Paid Off Business Line')).not.toBeInTheDocument();
  });
});
