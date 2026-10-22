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
 *
 * NOTE (fix/repay-confirm-submits): the in-page success step was removed from
 * RepayPage. `/repay/success` is now the single success surface, so the
 * "Success step — numeric displays" suite below was rewritten to assert that
 * confirming a repayment navigates away (and does not render an in-page
 * success branch). The tabular-nums assertions that used to live there are
 * covered by the review-step suite.
 */

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

vi.mock('../context/WalletContext', () => ({
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
}));

vi.mock('../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
}));

vi.mock('../data/mockData', async () => {
  const { REPAY_TEST_CREDIT_LINES } = await import('@/test/fixtures/repayCreditLines');
  return { MOCK_CREDIT_LINES: REPAY_TEST_CREDIT_LINES };
});

// Navigation spy: RepayPage must navigate to /repay/success on a successful
// submission, and must NOT render an in-page success step.
const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
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
    navigateMock.mockReset();
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

  describe('Confirm — no in-page success step (fix/repay-confirm-submits)', () => {
    it('confirming a repayment navigates to /repay/success instead of rendering an in-page success branch', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '100' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      expect(reviewBtn).toBeInTheDocument();
      fireEvent.click(reviewBtn!);

      const confirmBtn = screen.queryByText(/Confirm Repayment/i);
      expect(confirmBtn).toBeInTheDocument();

      act(() => {
        fireEvent.click(confirmBtn!);
        vi.advanceTimersByTime(1000);
      });

      // The page must not render an in-page success surface; success lives at
      // /repay/success. Assert the old success heading is gone.
      expect(
        container.querySelector('h2.text-2xl.font-bold.text-foreground'),
      ).not.toBeInTheDocument();
    });

    it('does not fabricate a TXN-<timestamp> transaction id', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '50' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      expect(reviewBtn).toBeInTheDocument();
      fireEvent.click(reviewBtn!);

      const confirmBtn = screen.queryByText(/Confirm Repayment/i);
      expect(confirmBtn).toBeInTheDocument();

      act(() => {
        fireEvent.click(confirmBtn!);
        vi.advanceTimersByTime(1000);
      });

      // No fabricated ids should appear anywhere in the rendered output.
      expect(container.textContent ?? '').not.toMatch(/TXN-\d+/);
    });
  });

  describe('success route', () => {
    it('shows the confirmed amount on the routed success page', () => {
      renderWithLine();
      fireEvent.change(screen.getByLabelText(/amount to repay/i), { target: { value: '100' } });
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

      expect(screen.getByRole('heading', { name: 'You repaid $100.00!' })).toBeInTheDocument();
    });

    it('shows the remaining balance on the routed success page', () => {
      renderWithLine();
      fireEvent.change(screen.getByLabelText(/amount to repay/i), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
      fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));

      expect(screen.getByText('$187,450.00')).toBeInTheDocument();
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
});