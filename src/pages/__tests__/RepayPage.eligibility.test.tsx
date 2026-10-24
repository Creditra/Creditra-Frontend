/**
 * RepayPage eligibility tests — Issue #1185
 *
 * Test plan:
 * Test 1 — picker shows CL-2024-001, CL-2024-002, CL-2023-003, CL-2023-004
 *           but not Closed or zero-balance lines
 * Test 2 — Defaulted and Suspended come before Active in the picker
 * Test 3 — ?line=CL-2022-005 (Closed) → status message + picker; no form
 * Test 4 — ?line=CL-2023-004 (Defaulted) → form opens
 * Test 5 — QuickRepay candidate set equals getRepayableLines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mock WalletContext ───────────────────────────────────────────────────────

vi.mock('@/context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: [
      {
        asset: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '99999.0000000',
      },
    ],
    refreshBalance: async () => [
      {
        asset: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '99999.0000000',
      },
    ],
  }),
}));

// ─── Mock mockData — mirror of src/data/mockData fixture lines ────────────────

vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 500_000,
      utilized: 187_500,
      apr: 8.5,
      riskScore: 720,
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 3_200,
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-2024-002',
      name: 'Expansion Capital Line',
      status: 'Active',
      limit: 250_000,
      utilized: 210_000,
      apr: 9.25,
      riskScore: 685,
      openedAt: '2024-06-01',
      updatedAt: '2025-02-19T09:15:00Z',
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-2023-003',
      name: 'Working Capital Facility',
      status: 'Suspended',
      limit: 100_000,
      utilized: 45_000,
      apr: 11.0,
      riskScore: 610,
      openedAt: '2023-11-10',
      updatedAt: '2025-01-15T16:45:00Z',
      transactions: [],
      statusHistory: [
        { status: 'Active', date: '2023-11-10', note: 'Line opened' },
        { status: 'Suspended', date: '2025-01-15', note: 'Missed payment' },
      ],
    },
    {
      id: 'CL-2023-004',
      name: 'Emergency Reserve Line',
      status: 'Defaulted',
      limit: 75_000,
      utilized: 75_000,
      apr: 14.5,
      riskScore: 490,
      openedAt: '2023-05-20',
      updatedAt: '2024-11-01T10:00:00Z',
      transactions: [],
      statusHistory: [
        { status: 'Active', date: '2023-05-20', note: 'Line opened' },
        { status: 'Defaulted', date: '2024-11-01', note: '90+ days overdue' },
      ],
    },
    {
      id: 'CL-2022-005',
      name: 'Startup Seed Line',
      status: 'Closed',
      limit: 50_000,
      utilized: 0,
      apr: 10.0,
      riskScore: 740,
      openedAt: '2022-08-01',
      updatedAt: '2024-06-30T12:00:00Z',
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-2025-006',
      name: 'Revolving Credit Line',
      status: 'Active',
      limit: 100_000,
      utilized: 0,
      apr: 7.5,
      riskScore: 750,
      openedAt: '2025-01-15',
      updatedAt: '2025-02-20T10:00:00Z',
      transactions: [],
      statusHistory: [],
    },
  ],
}));

import RepayPage from '../RepayPage';
import { getRepayableLines } from '@/lib/repay-eligibility';
import { MOCK_CREDIT_LINES } from '@/data/mockData';

function renderPage(initialEntries = ['/repay']) {
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

describe('RepayPage — issue #1185 eligibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // ─── Test 1: picker shows exactly the right four lines ──────────────────────

  describe('Test 1 — picker includes Active, Suspended, Defaulted lines with balance', () => {
    it('shows Active line CL-2024-001 (Primary Business Line)', () => {
      renderPage();
      expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
    });

    it('shows Active line CL-2024-002 (Expansion Capital Line)', () => {
      renderPage();
      expect(screen.getByText('Expansion Capital Line')).toBeInTheDocument();
    });

    it('shows Suspended line CL-2023-003 (Working Capital Facility)', () => {
      renderPage();
      expect(screen.getByText('Working Capital Facility')).toBeInTheDocument();
    });

    it('shows Defaulted line CL-2023-004 (Emergency Reserve Line)', () => {
      renderPage();
      expect(screen.getByText('Emergency Reserve Line')).toBeInTheDocument();
    });

    it('does NOT show Closed line CL-2022-005 (Startup Seed Line)', () => {
      renderPage();
      expect(screen.queryByText('Startup Seed Line')).not.toBeInTheDocument();
    });

    it('does NOT show Active zero-balance line CL-2025-006 (Revolving Credit Line)', () => {
      renderPage();
      expect(screen.queryByText('Revolving Credit Line')).not.toBeInTheDocument();
    });
  });

  // ─── Test 2: order — delinquent lines come first ────────────────────────────

  describe('Test 2 — delinquent lines sort before active lines', () => {
    it('Defaulted/Suspended lines appear before Active lines in the picker', () => {
      renderPage();
      const cards = screen.getAllByRole('button', { name: /line/i });
      // Filter to the credit-line cards (exclude Back button etc.)
      const clCards = cards.filter((btn) => btn.classList.contains('rp-cl-card'));

      const names = clCards.map((c) => c.textContent ?? '');
      const suspendedIdx = names.findIndex((n) => n.includes('Working Capital Facility'));
      const defaultedIdx = names.findIndex((n) => n.includes('Emergency Reserve Line'));
      const activeIdx1 = names.findIndex((n) => n.includes('Primary Business Line'));
      const activeIdx2 = names.findIndex((n) => n.includes('Expansion Capital Line'));

      // Both delinquent lines must appear before both active lines.
      expect(suspendedIdx).toBeLessThan(activeIdx1);
      expect(suspendedIdx).toBeLessThan(activeIdx2);
      expect(defaultedIdx).toBeLessThan(activeIdx1);
      expect(defaultedIdx).toBeLessThan(activeIdx2);
    });

    it('delinquent cards have an "Overdue" label', () => {
      renderPage();
      const overdueLabels = screen.getAllByText('Overdue');
      // Two delinquent lines → two Overdue labels
      expect(overdueLabels).toHaveLength(2);
    });
  });

  // ─── Test 3: ?line=CL-2022-005 (Closed) → status message + picker ──────────

  describe('Test 3 — unrepayable ?line= shows notice and picker, not the form', () => {
    it('renders the unrepayable status notice', () => {
      renderPage(['/repay?line=CL-2022-005']);
      const notice = screen.getByTestId('repay-unrepayable-notice');
      expect(notice).toBeInTheDocument();
      expect(notice).toHaveAttribute('role', 'status');
      expect(notice).toHaveTextContent('This line has no outstanding balance');
    });

    it('still shows the picker (not the repayment form)', () => {
      renderPage(['/repay?line=CL-2022-005']);
      // Picker heading is present
      expect(
        screen.getByRole('heading', { name: /select a credit line to repay/i }),
      ).toBeInTheDocument();
      // Repay form "Make a repayment" heading is absent
      expect(screen.queryByText('Make a repayment')).not.toBeInTheDocument();
    });

    it('does not open the form for a Closed line', () => {
      renderPage(['/repay?line=CL-2022-005']);
      expect(screen.queryByRole('spinbutton', { name: /amount to repay/i })).not.toBeInTheDocument();
    });
  });

  // ─── Test 4: ?line=CL-2023-004 (Defaulted) → form opens ───────────────────

  describe('Test 4 — repayable ?line= with Defaulted status opens the form', () => {
    it('opens the repayment form for a Defaulted line', () => {
      renderPage(['/repay?line=CL-2023-004']);
      expect(screen.getByText('Make a repayment')).toBeInTheDocument();
    });

    it('shows the Emergency Reserve Line name in the form header', () => {
      renderPage(['/repay?line=CL-2023-004']);
      expect(
        screen.getByText((content) => content.includes('Emergency Reserve Line')),
      ).toBeInTheDocument();
    });

    it('does NOT show the unrepayable notice for a Defaulted line with balance', () => {
      renderPage(['/repay?line=CL-2023-004']);
      expect(screen.queryByTestId('repay-unrepayable-notice')).not.toBeInTheDocument();
    });
  });

  // ─── Test 5: QuickRepay candidate set ──────────────────────────────────────

  describe('Test 5 — QuickRepay candidate set equals getRepayableLines', () => {
    it('getRepayableLines(MOCK_CREDIT_LINES) contains the four expected ids', () => {
      const result = getRepayableLines(MOCK_CREDIT_LINES);
      const ids = result.map((l) => l.id);
      expect(ids).toContain('CL-2024-001');
      expect(ids).toContain('CL-2024-002');
      expect(ids).toContain('CL-2023-003');
      expect(ids).toContain('CL-2023-004');
    });

    it('getRepayableLines excludes Closed and zero-balance lines', () => {
      const result = getRepayableLines(MOCK_CREDIT_LINES);
      const ids = result.map((l) => l.id);
      expect(ids).not.toContain('CL-2022-005');
      expect(ids).not.toContain('CL-2025-006');
    });

    it('getRepayableLines returns exactly 4 lines from the fixture', () => {
      expect(getRepayableLines(MOCK_CREDIT_LINES)).toHaveLength(4);
    });
  });

  // ─── Status badges visible on delinquent cards ─────────────────────────────

  describe('Accessibility — badges convey status by text, not colour alone', () => {
    it('Suspended card shows a StatusBadge with accessible label', () => {
      renderPage();
      const badge = screen.getByLabelText('Credit line status: Suspended');
      expect(badge).toBeInTheDocument();
    });

    it('Defaulted card shows a StatusBadge with accessible label', () => {
      renderPage();
      const badge = screen.getByLabelText('Credit line status: Defaulted');
      expect(badge).toBeInTheDocument();
    });
  });
});
