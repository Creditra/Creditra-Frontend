/**
 * RepayPage.improvements.test.tsx
 *
 * Focused tests for the four GrantFox FWC26 improvements:
 *
 *   cb-v7      – pattern fills on utilization bars and severity banners
 *   resp-v7    – responsive breakpoint classes
 *   ariallive-v7 – LiveRegion SR announcements
 *   tokens-v7  – design-token usage (no raw hex, no bare Tailwind color utils)
 *
 * These tests are isolated from the existing RepayPage.test.tsx suite to
 * prevent mock leakage (see comment in that file).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepayPage from '../RepayPage';

// ── Shared mock ──────────────────────────────────────────────────────────────
vi.mock('@/data/mockData', () => ({
  MOCK_CREDIT_LINES: [
    {
      id: 'CL-TEST-001',
      name: 'Test Business Line',
      status: 'Active',
      limit: 100000,
      utilized: 85000,   // ~85% → high utilization (rp-progress--high)
      apr: 9.0,
      riskScore: 680,
      collateral: 'Equipment',
      openedAt: '2024-01-01',
      updatedAt: '2025-01-01T00:00:00Z',
      nextPaymentDate: '2025-02-01',
      nextPaymentAmount: 1500,
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-TEST-002',
      name: 'Low Use Line',
      status: 'Active',
      limit: 50000,
      utilized: 10000,   // 20% → low utilization (rp-progress--low)
      apr: 7.5,
      riskScore: 750,
      openedAt: '2024-01-01',
      updatedAt: '2025-01-01T00:00:00Z',
      transactions: [],
      statusHistory: [],
    },
    {
      id: 'CL-TEST-003',
      name: 'Mid Use Line',
      status: 'Active',
      limit: 40000,
      utilized: 26000,   // 65% → medium utilization (rp-progress--medium)
      apr: 8.0,
      riskScore: 710,
      openedAt: '2024-01-01',
      updatedAt: '2025-01-01T00:00:00Z',
      transactions: [],
      statusHistory: [],
    },
  ],
}));

function render$(initialEntries = ['/repay']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPage />
    </MemoryRouter>,
  );
}

// ── cb-v7: Pattern fills ─────────────────────────────────────────────────────
describe('cb-v7 – pattern fills on utilization bars', () => {
  it('applies rp-progress--high on the selection-view bar for 85% utilization', () => {
    const { container } = render$();
    // The first credit line (CL-TEST-001) has 85% utilization → high
    const bars = container.querySelectorAll('.rp-progress--high');
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it('applies rp-progress--low on the selection-view bar for 20% utilization', () => {
    const { container } = render$();
    const lowBars = container.querySelectorAll('.rp-progress--low');
    expect(lowBars.length).toBeGreaterThanOrEqual(1);
  });

  it('applies rp-progress--medium on the selection-view bar for 65% utilization', () => {
    const { container } = render$();
    const medBars = container.querySelectorAll('.rp-progress--medium');
    expect(medBars.length).toBeGreaterThanOrEqual(1);
  });

  it('applies rp-progress--high on the current-debt bar in the input step', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const bar = container.querySelector('.rp-progress--high');
    expect(bar).not.toBeNull();
  });

  it('applies rp-progress--ghost class on the preview ghost bar', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    expect(container.querySelector('.rp-progress--ghost')).not.toBeNull();
  });

  it('applies rp-severity--info class on the feedback banner by default', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    // No amount entered → info severity
    expect(container.querySelector('.rp-severity--info')).not.toBeNull();
  });

  it('applies rp-severity--danger class on the feedback banner for an invalid amount', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    // Enter an amount exceeding the debt → triggers danger severity
    fireEvent.change(input, { target: { value: '999999' } });
    expect(container.querySelector('.rp-severity--danger')).not.toBeNull();
  });

  it('applies rp-severity--success on a valid full-payoff amount', () => {
    // CL-TEST-002: utilized=10000, walletBalance=50000 → full payoff possible
    const { container } = render$(['/repay?line=CL-TEST-002']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '10000' } });
    expect(container.querySelector('.rp-severity--success')).not.toBeNull();
  });

  it('progress bar elements carry aria-hidden so patterns are decorative', () => {
    const { container } = render$();
    const bars = container.querySelectorAll(
      '.rp-progress--high, .rp-progress--medium, .rp-progress--low',
    );
    bars.forEach((bar) => {
      expect(bar.getAttribute('aria-hidden')).toBe('true');
    });
  });
});

// ── resp-v7: Responsive breakpoints ─────────────────────────────────────────
describe('resp-v7 – responsive breakpoint classes', () => {
  it('selection-view wrapper has sm:max-w-2xl breakpoint class', () => {
    const { container } = render$();
    // The outer div should have sm:max-w-2xl for wider screens
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toMatch(/sm:max-w-2xl/);
  });

  it('selection-view wrapper has sm:px-6 padding class', () => {
    const { container } = render$();
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toMatch(/sm:px-6/);
  });

  it('main page wrapper has sm:px-6 padding at small breakpoint', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toMatch(/sm:px-6/);
  });

  it('main page wrapper has sm:py-8 vertical padding class', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toMatch(/sm:py-8/);
  });

  it('two-column grid switches at md breakpoint', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    // Finds the grid container with the md: column class
    const grid = container.querySelector('[class*="md:grid-cols"]');
    expect(grid).not.toBeNull();
  });

  it('aside is sticky at md breakpoint not lg', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const aside = container.querySelector('aside');
    expect(aside?.className).toMatch(/md:sticky/);
  });

  it('aside does not have the old lg:sticky class', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const aside = container.querySelector('aside');
    expect(aside?.className).not.toMatch(/lg:sticky/);
  });
});

// ── ariallive-v7: Live region announcements ──────────────────────────────────
describe('ariallive-v7 – SR live region', () => {
  it('renders a live region element on the selection view', () => {
    render$();
    expect(screen.getByTestId('live-region')).toBeInTheDocument();
  });

  it('renders a live region element on the input step', () => {
    render$(['/repay?line=CL-TEST-001']);
    expect(screen.getByTestId('live-region')).toBeInTheDocument();
  });

  it('live region has aria-live="polite"', () => {
    render$(['/repay?line=CL-TEST-001']);
    const region = screen.getByTestId('live-region');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('live region has aria-atomic="true"', () => {
    render$(['/repay?line=CL-TEST-001']);
    const region = screen.getByTestId('live-region');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('live region is visually hidden via sr-only class', () => {
    render$(['/repay?line=CL-TEST-001']);
    const region = screen.getByTestId('live-region');
    expect(region).toHaveClass('sr-only');
  });

  it('announces Smart Pay amount when clicked', () => {
    // CL-TEST-002: utilized=10000, walletBalance=50000, no nextPaymentAmount.
    // suggestRepayAmount → amountToTargetUtil=max(0,10000-25000)=0,
    //   minimumSuggested=monthlyInterest≈62.50, suggested=62.50,
    //   maxAffordable=45000 → 62.50.  Just check the announcement fires.
    render$(['/repay?line=CL-TEST-001']);
    const smartPayBtn = screen.getByRole('button', { name: /smart pay/i });
    fireEvent.click(smartPayBtn);
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/smart pay amount set/i);
    // The amount must be a formatted money string
    expect(region.textContent).toMatch(/\$/);
  });

  it('announces the review step transition with the repay amount', () => {
    render$(['/repay?line=CL-TEST-002']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/review step/i);
    expect(region.textContent).toMatch(/\$5,000\.00/i);
  });

  it('announces success after confirm', () => {
    render$(['/repay?line=CL-TEST-002']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    // Enter an amount below the 5000 confirmation threshold so no typed
    // confirmation is required and the Confirm button is immediately enabled.
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/payment successful/i);
  });

  it('announces "back to input" when stepping back from review', () => {
    render$(['/repay?line=CL-TEST-002']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/back to input/i);
  });

  it('announces the credit line name when selected in the selection view', () => {
    render$();
    fireEvent.click(screen.getByRole('button', { name: /test business line/i }));
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/test business line/i);
  });

  it('announces a new repayment when "Make another repayment" is clicked', () => {
    render$(['/repay?line=CL-TEST-002']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /review repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm repayment/i }));
    fireEvent.click(screen.getByRole('button', { name: /make another repayment/i }));
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/new repayment/i);
  });

  it('announces a validation error to the live region when an invalid amount is entered', () => {
    render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    // Entering an amount exceeding the utilized amount (85000)
    fireEvent.change(input, { target: { value: '999999' } });
    const region = screen.getByTestId('live-region');
    expect(region.textContent).toMatch(/Error:/i);
  });
});

// ── tokens-v7: Design-token usage ────────────────────────────────────────────
describe('tokens-v7 – design-token usage', () => {
  it('amount input border-color references var(--error) not a raw hex for danger state', () => {
    render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    // Enter an over-limit amount to force danger border
    fireEvent.change(input, { target: { value: '999999' } });
    const style = (input as HTMLElement).style;
    // borderColor should be the CSS variable reference, not a literal hex
    expect(style.borderColor).toBe('var(--error)');
  });

  it('amount input border-color references var(--warning) for warning state', () => {
    // CL-TEST-002: utilized=10000, walletBalance=50000.
    // Warning fires when remainingWalletBalance < recommendedWalletReserve (5000).
    // So entering 46000 leaves 4000 < 5000 → warning.
    // But 46000 > utilized(10000) → danger (exceeds debt). Instead use
    // CL-TEST-001: utilized=85000, walletBalance=50000.
    // Entering 46000: ≤85000, leaves 4000 wallet < 5000 reserve → warning.
    render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '46000' } });
    const style = (input as HTMLElement).style;
    expect(style.borderColor).toBe('var(--warning)');
  });

  it('amount input border-color references var(--accent) for a valid amount', () => {
    render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    fireEvent.change(input, { target: { value: '5000' } });
    const style = (input as HTMLElement).style;
    expect(style.borderColor).toBe('var(--accent)');
  });

  it('amount input border-color references var(--border) with no input', () => {
    render$(['/repay?line=CL-TEST-001']);
    const input = screen.getByRole('spinbutton', { name: /amount to repay/i });
    const style = (input as HTMLElement).style;
    expect(style.borderColor).toBe('var(--border)');
  });

  it('severity banner background references a CSS token via inline style', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const banner = container.querySelector('.rp-severity--info') as HTMLElement | null;
    expect(banner).not.toBeNull();
    // The background property should reference var(--accent-tint)
    expect(banner!.style.background).toBe('var(--accent-tint)');
  });

  it('severity banner border references a CSS token via inline style', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    const banner = container.querySelector('.rp-severity--info') as HTMLElement | null;
    expect(banner).not.toBeNull();
    // The border is set as a shorthand — check style.border which includes
    // the token reference string (jsdom preserves custom property strings).
    const borderVal = banner!.style.border;
    expect(borderVal).toMatch(/var\(--accent-border\)/);
  });

  it('no raw hex values appear in SEVERITY_CONFIG banner inline styles', () => {
    const { container } = render$(['/repay?line=CL-TEST-001']);
    // Check all rp-severity-* elements for absence of raw hex in inline style
    const severityEls = container.querySelectorAll(
      '.rp-severity--info, .rp-severity--success, .rp-severity--warning, .rp-severity--danger',
    );
    severityEls.forEach((el) => {
      const { background, borderColor, color } = (el as HTMLElement).style;
      expect(background).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(borderColor).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(color).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    });
  });
});
