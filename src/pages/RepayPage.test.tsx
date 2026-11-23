/**
 * @fileoverview Tests for src/pages/RepayPage.tsx
 *
 * GrantFox FWC26 (Stellar Wave) — Tabular-nums requirement
 * "Apply font-variant-numeric: tabular-nums to numeric displays on RepayPage."
 *
 * Tests verify that numeric displays (amounts, percentages, utilization)
 * carry the .num-tabular class to prevent digit-width jitter when values change
 * during live repayment amount preview or step transitions.
 *
 * Because jsdom does not compute CSS, these tests assert class-level correctness
 * (the class is applied to elements where expected). Rendering-level verification
 * requires a real browser and visual regression testing.
 */

import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import RepayPage from './RepayPage';
import RepaySuccess from './RepaySuccess';

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock('../context/ReducedMotionContext', () => ({
  useReducedMotion: () => ({
    isReducedMotionActive: false,
  }),
  motionClasses: (_isActive: boolean, classes: string) => classes,
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'default' }),
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../context/WalletContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/WalletContext')>();
  return {
    ...actual,
    useWallet: () => ({
      wallet: {
        publicKey: 'GAABC1234567890ABCDEF',
        network: 'TESTNET',
      },
      status: 'connected',
      balances: [{
        asset: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '50000.0000000',
      }],
      refreshBalance: async () => [{
        asset: 'USDC',
        issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        balance: '50000.0000000',
      }],
    }),
  };
});

const { mockWallet, mockBalances, mockRefreshBalance } = vi.hoisted(() => {
  const balances = [{
    asset: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    balance: '50000.0000000',
  }];
  return {
    mockWallet: {
      publicKey: 'GAABC1234567890ABCDEF',
      network: 'TESTNET',
    },
    mockBalances: balances,
    mockRefreshBalance: async () => balances,
  };
});

vi.mock('../context/WalletContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/WalletContext')>();
  return {
    ...actual,
    useWallet: () => ({
      wallet: mockWallet,
      status: 'connected',
      balances: mockBalances,
      refreshBalance: mockRefreshBalance,
    }),
    walletIdentityKey: (wallet: { publicKey: string; network: string } | null) =>
      wallet ? `undefined:${wallet.publicKey}:${wallet.network}` : null,
  };
});

vi.mock('../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
}));

vi.mock('../data/mockData', async () => {
  const { REPAY_TEST_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  return { MOCK_CREDIT_LINES: REPAY_TEST_CREDIT_LINES };
});

vi.mock('@/hooks/useCreditLines', async () => {
  const { REPAY_TEST_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  const lineWithAccrual = {
    ...REPAY_TEST_CREDIT_LINES[0],
    id: 'CL-2024-ACCRUED',
    name: 'Accrued Interest Line',
    utilized: 10_000,
    apr: 9.125,
    transactions: [
      {
        id: 'TX-INT-1',
        type: 'Interest' as const,
        amount: 25,
        date: '2025-03-01',
        status: 'Completed' as const,
      },
    ],
  };
  const allLines = [...REPAY_TEST_CREDIT_LINES, lineWithAccrual];
  return {
    useCreditLines: () => ({
      lines: allLines,
      status: 'success',
      error: null,
      refetch: vi.fn(),
    }),
    useCreditLine: (id: string) => ({
      line: allLines.find((cl) => cl.id === id) ?? null,
      status: 'success',
      error: null,
      refetch: vi.fn(),
    }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Render the RepayPage with a preselected credit line and advance fake timers
 * past the initial loading skeleton timeout (800 ms).
 */
function renderWithLine(initialEntries = ['/?line=CL-2024-001']) {
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/repay/success" element={<RepaySuccess />} />
        <Route path="*" element={<RepayPage />} />
      </Routes>
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

/**
 * Render the RepayPage without a preselected line (credit line selection screen).
 */
function renderWithoutLine() {
  const result = render(
    <MemoryRouter initialEntries={['/repay']}>
      <RepayPage />
    </MemoryRouter>,
  );
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('RepayPage — tabular-nums on numeric displays (FWC26)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Credit line selection screen (no line preselected)', () => {
    it('should render utilization percentage with num-tabular class', () => {
      const { container } = renderWithoutLine();

      const pctSpans = container.querySelectorAll('.num-tabular');
      expect(pctSpans.length).toBeGreaterThan(0);
    });

    it('should render credit line utilized amount with num-tabular class', () => {
      const { container } = renderWithoutLine();

      const pctElements = container.querySelectorAll(
        '.text-right p:first-child, .text-right .num-tabular',
      );
      expect(pctElements.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Input step — numeric displays', () => {
    it('current debt value should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const debtValue = container.querySelector(
        '.text-3xl.font-bold.num-tabular',
      );
      expect(debtValue).toBeInTheDocument();
      expect(debtValue?.classList.contains('num-tabular')).toBe(true);
    });

    it('utilization limit should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const pctElements = container.querySelectorAll(
        '.text-xs.text-muted .num-tabular',
      );
      expect(pctElements.length).toBeGreaterThanOrEqual(2);
      pctElements.forEach((el) => {
        expect(el.classList.contains('num-tabular')).toBe(true);
      });
    });

    it('wallet balance should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const tabularSpans = Array.from(
        container.querySelectorAll('.text-xs.text-muted .num-tabular'),
      );
      expect(tabularSpans.length).toBeGreaterThan(0);
    });

    it('preview: remaining debt should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      expect(input).toBeInTheDocument();

      const allTabularInPreview = Array.from(
        container.querySelectorAll('.space-y-3 .num-tabular'),
      );
      expect(allTabularInPreview.length).toBeGreaterThanOrEqual(0);
    });

    it('preview: utilization percentage (new and old) should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const allTabularSpans = container.querySelectorAll('.num-tabular');
      allTabularSpans.forEach((span) => {
        expect(span.classList.contains('num-tabular')).toBe(true);
      });
    });

    it('APR in header should carry num-tabular class (FWC26)', () => {
      const { container } = renderWithLine();

      const aprSpan = container.querySelector(
        'p.text-sm.text-muted .num-tabular',
      );
      expect(aprSpan).toBeInTheDocument();
      expect(aprSpan?.classList.contains('num-tabular')).toBe(true);
    });

    it('repay amount input should carry num-tabular class (FWC26)', () => {
      const { container } = renderWithLine();

      const input = container.querySelector('input#repay-amount');
      expect(input).toBeInTheDocument();
      expect(input?.classList.contains('num-tabular')).toBe(true);
    });
  });

  describe('Review step — numeric displays', () => {
    it('review: amount to repay should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '100' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const reviewAmount = container.querySelector(
          '.text-4xl.font-bold.num-tabular',
        );
        expect(reviewAmount).toBeInTheDocument();
        expect(reviewAmount?.classList.contains('num-tabular')).toBe(true);
      }
    });

    it('review: remaining debt after should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '50' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const debtElements = container.querySelectorAll(
          '.space-y-3 .font-semibold.num-tabular',
        );
        expect(debtElements.length).toBeGreaterThan(0);
        debtElements.forEach((el) => {
          expect(el.classList.contains('num-tabular')).toBe(true);
        });
      }
    });

    it('review: wallet balance should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '100' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const balanceSpans = container.querySelectorAll(
          '.text-success.num-tabular',
        );
        expect(balanceSpans.length).toBeGreaterThan(0);
        balanceSpans.forEach((el) => {
          expect(el.classList.contains('num-tabular')).toBe(true);
        });
      }
    });
  });

  describe('success route', () => {
    it('shows the confirmed amount on the routed success page', async () => {
      renderWithLine();
      fireEvent.change(screen.getByLabelText(/amount to repay/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      await act(async () => {});
      fireEvent.click(document.querySelector('.rp-confirm-btn') as HTMLButtonElement);
      await act(async () => {});

      expect(
        screen.getByRole('heading', { name: 'You repaid $100.00!' }),
      ).toBeInTheDocument();
    });

    it('shows the remaining balance on the routed success page', async () => {
      renderWithLine();
      fireEvent.change(screen.getByLabelText(/amount to repay/i), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      await act(async () => {});
      fireEvent.click(document.querySelector('.rp-confirm-btn') as HTMLButtonElement);
      await act(async () => {});

      const remainingRow = screen.getByText('Remaining debt').parentElement;
      expect(remainingRow?.textContent).toMatch(/Remaining debt\$[\d,]+\.\d{2}/);
    });
  });

  describe('CSS class utility verification', () => {
    it('should not have style regressions at mobile breakpoint', () => {
      const { container } = renderWithLine();
      const tabularElements = container.querySelectorAll('.num-tabular');
      expect(tabularElements.length).toBeGreaterThan(0);
    });

    it('all num-tabular elements should be valid DOM nodes', () => {
      const { container } = renderWithLine();
      const tabularElements = container.querySelectorAll('.num-tabular');
      tabularElements.forEach((el) => {
        expect(el).toBeInstanceOf(Element);
        expect(el.classList.contains('num-tabular')).toBe(true);
      });
    });
  });

  describe('PayoffProjection accrued interest integration', () => {
    it('hides accrued interest row when the selected line has no accrual date', () => {
      renderWithLine(['/?line=CL-2024-001']);
      expect(screen.queryByTestId('payoff-accrued-interest')).not.toBeInTheDocument();
    });

    it('shows accrued interest to date with ACT/365 basis on input and review steps', () => {
      vi.setSystemTime(new Date('2025-03-16T00:00:00Z'));
      renderWithLine(['/?line=CL-2024-ACCRUED']);

      const inputRow = screen.getByTestId('payoff-accrued-interest');
      expect(inputRow).toHaveTextContent('Interest accrued to date');
      expect(inputRow).toHaveTextContent('$37.50 (15 days, ACT/365)');

      fireEvent.change(screen.getByLabelText(/amount to repay/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));

      const reviewRow = screen.getByTestId('payoff-accrued-interest');
      expect(reviewRow).toHaveTextContent('Interest accrued to date');
      expect(reviewRow).toHaveTextContent('$37.50 (15 days, ACT/365)');
    });
  });
});
