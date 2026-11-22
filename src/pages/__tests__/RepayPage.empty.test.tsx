import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { renderWithCredit } from '../../test/renderWithCredit';
import type { CreditLine } from '../../types/creditLine';
// Local mock — this file is the empty-state suite, so we override the
// module with `vi.mock` (hoisted) right at the top. The populated suite in
// `RepayPage.test.tsx` is unaffected because they live in separate files.
vi.mock('@/data/mockData', async () => {
  const { REPAY_EMPTY_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  return { MOCK_CREDIT_LINES: REPAY_EMPTY_CREDIT_LINES };
});

vi.mock('@/context/WalletContext', async () => {
  const actual = await vi.importActual<typeof import('@/context/WalletContext')>(
    '@/context/WalletContext',
  );
  return {
    ...actual,
    useWallet: () => ({
      wallet: { publicKey: 'GTEST', network: 'TESTNET' },
      status: 'connected',
      balances: [],
      refreshBalance: async () => [],
    }),
  };
});

import RepayPage from '../RepayPage';

function renderEmpty(initialEntries = ['/repay'], lines: CreditLine[] = []) {
  return renderWithCredit(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPage />
    </MemoryRouter>,
    { withRouter: false, lines },
  );
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
  it('renders the themed empty state when no repayable lines exist', async () => {
    renderEmpty();

    expect(
      await screen.findByRole('heading', { name: 'Nothing to repay right now' }),
    ).toBeInTheDocument();
    // Match a description-unique fragment so the assertion stays specific
    // (independent of the apostrophe glyph used in the source string).
    expect(
      screen.getByText(/outstanding balance/i),
    ).toBeInTheDocument();
  });

  it('exposes primary CTA to /open-credit', async () => {
    renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

    const cta = screen.getByRole('link', { name: /request a credit line/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/open-credit');
  });

  it('exposes a secondary CTA back to the dashboard', async () => {
    renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

    const secondary = screen.getByRole('link', { name: /back to dashboard/i });
    expect(secondary).toBeInTheDocument();
    expect(secondary).toHaveAttribute('href', '/');
  });

  it('exposes the empty-state region with role=status and aria-live=polite', async () => {
    renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

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

  it('renders the illustrative SVG and the accent eyebrow', async () => {
    const { container } = renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

    const illustration = container.querySelector('.empty-state-illustration--muted');
    expect(illustration).not.toBeNull();
    expect(illustration?.getAttribute('aria-hidden')).toBe('true');

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('hides the credit-line list selection buttons in the empty state', async () => {
    renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

    // No credit-line selection buttons should be present.
    expect(
      screen.queryByRole('button', { name: /primary business line/i }),
    ).not.toBeInTheDocument();
    // The Back button (navigate(-1)) at the top of the page still exists.
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument();
  });

  it('preserves the Back button and the page header', async () => {
    renderEmpty();
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

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
  it('renders the empty state when the only line has utilized === 0', async () => {
    const zeroUtilizationLine = {
      id: 'CL-EMPTY-001',
      name: 'Paid Off Business Line',
      status: 'Active' as const,
      limit: 100_000,
      utilized: 0,
      apr: 7.5,
      riskScore: 800,
      collateral: 'Equipment',
      openedAt: '2024-01-01',
      updatedAt: '2025-01-01T00:00:00Z',
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    };
    renderEmpty(['/repay'], [zeroUtilizationLine]);
    await screen.findByRole('heading', { name: 'Nothing to repay right now' });

    // The paid-off line itself must not appear in the selection list.
    expect(screen.queryByText(zeroUtilizationLine.name)).not.toBeInTheDocument();
  });
});
