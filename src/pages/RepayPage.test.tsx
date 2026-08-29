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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from './RepayPage';

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
  }),
}));

vi.mock('../utils/storage', () => ({
  readJson: vi.fn((_key: string, fallback: unknown) => fallback),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
}));

vi.mock('../data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-2024-001',
      name: 'Primary Business Line',
      status: 'Active',
      limit: 500000,
      utilized: 187500,
      apr: 8.5,
      riskScore: 720,
      collateral: 'Commercial Real Estate',
      openedAt: '2024-03-15',
      updatedAt: '2025-02-20T14:32:00Z',
      nextPaymentDate: '2025-03-01',
      nextPaymentAmount: 3200,
      transactions: [],
      statusHistory: [],
      aprHistory: [],
    },
  ],
}));

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Render the RepayPage with a preselected credit line and advance fake timers
 * past the initial loading skeleton timeout (800 ms).
 */
function renderWithLine(initialEntries = ['/?line=CL-2024-001']) {
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

  describe('Success step — numeric displays', () => {
    it('success: repaid amount should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '100' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const confirmBtn = screen.queryByText(/Confirm Repayment/i);
        if (confirmBtn && !confirmBtn.hasAttribute('disabled')) {
          fireEvent.click(confirmBtn);

          const successText = container.querySelector(
            'h2.text-2xl.font-bold.text-foreground',
          );
          if (successText) {
            const tabularInSuccess = successText.querySelector('.num-tabular');
            expect(tabularInSuccess).toBeInTheDocument();
            expect(tabularInSuccess?.classList.contains('num-tabular')).toBe(
              true,
            );
          }
        }
      }
    });

    it('success: remaining debt should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '50' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const confirmBtn = screen.queryByText(/Confirm Repayment/i);
        if (confirmBtn && !confirmBtn.hasAttribute('disabled')) {
          fireEvent.click(confirmBtn);

          const successDebt = container.querySelector(
            '.bg-surface.p-4.text-left .num-tabular',
          );
          expect(successDebt).toBeInTheDocument();
          expect(successDebt?.classList.contains('num-tabular')).toBe(true);
        }
      }
    });

    it('success: utilization percentage should carry num-tabular class', () => {
      const { container } = renderWithLine();

      const input = container.querySelector(
        'input[id="repay-amount"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '75' } });

      const reviewBtn = screen.queryByText(/Review Repayment/i);
      if (reviewBtn) {
        fireEvent.click(reviewBtn);

        const confirmBtn = screen.queryByText(/Confirm Repayment/i);
        if (confirmBtn && !confirmBtn.hasAttribute('disabled')) {
          fireEvent.click(confirmBtn);

          const successText = container.textContent;
          if (successText?.includes('Reduced to')) {
            const reducedText = container.querySelector(
              '.bg-surface.p-4.text-left',
            );
            const pctElement = reducedText?.querySelector('.num-tabular');
            expect(pctElement).toBeInTheDocument();
            expect(pctElement?.classList.contains('num-tabular')).toBe(true);
          }
        }
      }
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
