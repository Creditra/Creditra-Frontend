import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';

import { Simulator } from './Simulator';
import { mockCreditLines } from '@/lib/draw-credit-mock-data';
import { getDrawPricingQuote } from '@/lib/draw-credit-pricing';
import { projectDraw } from '@/lib/draw-projection';
import { computePayoffProjection } from '@/utils/payoffProjection';
import { formatMoney } from '@/utils/amountValidation';
import { SIMULATOR_DISCLAIMERS } from '@/copy/simulator';

function renderSimulator(initialEntries = ['/simulator']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Simulator />
    </MemoryRouter>,
  );
}

describe('Simulator Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders simulator header, controls, side-by-side metric cards, and disclaimers', () => {
    const { container } = renderSimulator();

    // Header & Titles
    expect(screen.getByRole('heading', { level: 1, name: /Credit & Repayment Simulator/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Simulator Inputs/i })).toBeInTheDocument();

    // Inputs
    expect(screen.getByLabelText(/Select Credit Line/i)).toBeInTheDocument();
    expect(container.querySelector('#draw-amount-input')).toBeInTheDocument();
    expect(screen.getByLabelText(/Repayment Cadence/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repayment Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Optional APR Override/i)).toBeInTheDocument();

    // Metric Cards
    expect(screen.getByRole('heading', { level: 3, name: /Draw Fee & Pricing/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Interest Accrual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Payoff Projection & Total Cost/i })).toBeInTheDocument();

    // Chart & Disclaimers
    expect(screen.getByRole('heading', { level: 3, name: /Projected Repayment Schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: new RegExp(SIMULATOR_DISCLAIMERS.title, 'i') })).toBeInTheDocument();
    expect(screen.getByText(SIMULATOR_DISCLAIMERS.summary)).toBeInTheDocument();
  });

  it('matches underlying library outputs for default fixtures', () => {
    renderSimulator();

    const cl001 = mockCreditLines[0]; // limit: 50000, utilization: 30%, available: 35000
    const defaultAmount = 5000;
    const defaultPayment = 500;

    const expectedQuote = getDrawPricingQuote(cl001, defaultAmount);
    const expectedProjection = projectDraw(cl001, defaultAmount, expectedQuote);
    const principalToRepay = defaultAmount + expectedQuote.fee;
    const expectedPayoff = computePayoffProjection(
      principalToRepay,
      expectedQuote.apr,
      defaultPayment,
      0,
      cl001.limit,
    );

    // Fee Quote
    const feeElement = screen.getByTestId('sim-fee-value');
    expect(feeElement).toHaveTextContent(formatMoney(expectedQuote.fee));

    // Quoted APR & Effective APR
    expect(screen.getByTestId('sim-quoted-apr')).toHaveTextContent(`${expectedQuote.apr}%`);
    expect(screen.getByTestId('sim-effective-apr')).toHaveTextContent(`${expectedQuote.apr}%`);

    // Utilization after draw
    expect(screen.getByTestId('sim-utilization-after')).toHaveTextContent(`${expectedProjection.newUtilizationPct}%`);

    // Monthly interest matches quote directly
    expect(screen.getByTestId('sim-monthly-interest-value')).toHaveTextContent(
      formatMoney(expectedQuote.estimatedMonthlyInterest),
    );

    // Total Interest and Cost
    expect(screen.getByTestId('sim-total-interest')).toHaveTextContent(formatMoney(expectedPayoff.newTotalInterest));
    const expectedTotalCost = formatMoney(principalToRepay + expectedPayoff.newTotalInterest);
    expect(screen.getByTestId('sim-total-cost')).toHaveTextContent(expectedTotalCost);

    // Repayment Plan Chart is present
    expect(screen.getByRole('img', { name: /repayment plan by week/i })).toBeInTheDocument();
  });

  it('updates live when selecting another credit line', () => {
    renderSimulator();

    const cl002 = mockCreditLines[1]; // cl-002, Equipment Finance, limit 100000, available 45000
    const select = screen.getByLabelText(/Select Credit Line/i);
    fireEvent.change(select, { target: { value: 'cl-002' } });

    const quoteForCl002 = getDrawPricingQuote(cl002, 5000);
    expect(screen.getByTestId('sim-quoted-apr')).toHaveTextContent(`${quoteForCl002.apr}%`);
  });

  it('initializes from shareable URL params and updates state', () => {
    const { container } = renderSimulator([
      '/simulator?line=cl-002&amount=10000&payment=800&cadence=biweekly&apr=8.75',
    ]);

    expect(screen.getByLabelText(/Select Credit Line/i)).toHaveValue('cl-002');
    expect(container.querySelector('#draw-amount-input')).toHaveValue(10000);
    expect(screen.getByLabelText(/Repayment Amount/i)).toHaveValue(800);
    expect(screen.getByLabelText(/Repayment Cadence/i)).toHaveValue('biweekly');
    expect(screen.getByLabelText(/Optional APR Override/i)).toHaveValue(8.75);

    // Quoted APR is for cl-002, but effective APR reflects override
    const cl002 = mockCreditLines[1];
    const quote = getDrawPricingQuote(cl002, 10000);
    expect(screen.getByTestId('sim-quoted-apr')).toHaveTextContent(`${quote.apr}%`);
    expect(screen.getByTestId('sim-effective-apr')).toHaveTextContent('8.75% (Override)');
  });

  it('supports copying the shareable URL', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    renderSimulator(['/simulator?line=cl-001&amount=5000']);

    const copyBtn = screen.getByRole('button', { name: /Copy shareable link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Link Copied!/i)).toBeInTheDocument();
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────────

  describe('Edge case: Draw exceeding limit', () => {
    it('shows inline error alert when draw amount exceeds available line limit', () => {
      const { container } = renderSimulator();

      const cl001 = mockCreditLines[0]; // Available: 35,000
      const drawInput = container.querySelector('#draw-amount-input')!;

      fireEvent.change(drawInput, { target: { value: '40000' } });

      const alert = screen.getByRole('alert', {
        name: /Draw amount exceeds available credit/i,
      });
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(`exceeds available credit of ${formatMoney(cl001.available)}`);
    });
  });

  describe('Edge case: Zero APR', () => {
    it('correctly calculates 0% interest and cost equal to principal + fee', () => {
      renderSimulator();

      const aprInput = screen.getByLabelText(/Optional APR Override/i);
      fireEvent.change(aprInput, { target: { value: '0' } });

      expect(screen.getByTestId('sim-effective-apr')).toHaveTextContent('0% (Override)');
      expect(screen.getByTestId('sim-monthly-interest-value')).toHaveTextContent(formatMoney(0));
      expect(screen.getByTestId('sim-total-interest')).toHaveTextContent(formatMoney(0));

      const drawAmount = 5000;
      const fee = getDrawPricingQuote(mockCreditLines[0], drawAmount).fee;
      const expectedTotalCost = formatMoney(drawAmount + fee);

      expect(screen.getByTestId('sim-total-cost')).toHaveTextContent(expectedTotalCost);
    });
  });

  describe('Edge case: Payment below interest', () => {
    it('shows inline warning and indicates loan is never paid off when payment <= monthly interest', () => {
      const { container } = renderSimulator();

      // cl-001 at $25,000 draw has APR 13.0%, monthly interest > $270
      const drawInput = container.querySelector('#draw-amount-input')!;
      fireEvent.change(drawInput, { target: { value: '25000' } });

      const paymentInput = screen.getByLabelText(/Repayment Amount/i);
      // Payment of $50/mo is far below monthly interest
      fireEvent.change(paymentInput, { target: { value: '50' } });

      const alert = screen.getByRole('alert', {
        name: /Payment below monthly interest/i,
      });
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Balance will never be paid off at this rate/i);

      // Payoff date card should reflect "Never" and "10+ years"
      expect(screen.getByTestId('sim-payoff-date-value')).toHaveTextContent('Never');
      expect(screen.getByTestId('sim-payoff-duration')).toHaveTextContent('10+ years');
    });
  });

  describe('Validation & Error Feedback', () => {
    it('shows inline error when APR override is negative', () => {
      renderSimulator();

      const aprInput = screen.getByLabelText(/Optional APR Override/i);
      fireEvent.change(aprInput, { target: { value: '-5' } });

      expect(aprInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert', { name: /APR override cannot be negative/i })).toBeInTheDocument();
    });

    it('shows inline error when repayment amount is zero or empty', () => {
      renderSimulator();

      const paymentInput = screen.getByLabelText(/Repayment Amount/i);
      fireEvent.change(paymentInput, { target: { value: '0' } });

      expect(paymentInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert', { name: /Enter a valid repayment amount/i })).toBeInTheDocument();
    });

    it('integrates with AffordabilityCalc to apply affordable repayment amount', () => {
      renderSimulator();

      const calcToggle = screen.getByRole('button', { name: /Calculate Affordable Repayment/i });
      fireEvent.click(calcToggle);

      expect(screen.getByRole('heading', { level: 2, name: /Affordability Calculator/i })).toBeInTheDocument();

      const incomeInput = screen.getByLabelText(/Monthly income/i);
      fireEvent.change(incomeInput, { target: { value: '6000' } });
      fireEvent.blur(incomeInput);

      const applyButton = screen.getByRole('button', { name: /Use this amount/i });
      expect(applyButton).toBeInTheDocument();
      fireEvent.click(applyButton);

      // 6000 * 0.36 = 2160
      expect(screen.getByLabelText(/Repayment Amount/i)).toHaveValue(2160);
    });
  });

  describe('Accessibility', () => {
    it('has no axe accessibility violations', async () => {
      const { container } = renderSimulator();

      const results = await axe.run(container, {
        rules: {
          'color-contrast': { enabled: false },
        },
      });

      expect(results.violations).toEqual([]);
    });
  });
});
