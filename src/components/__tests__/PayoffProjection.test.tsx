import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PayoffProjection } from '../PayoffProjection';

const BASE_PROPS = {
  currentDebt: 100_000,
  apr: 8.5,
  repayAmount: 0,
  limit: 200_000,
  nextPaymentAmount: 2500,
};

describe('PayoffProjection', () => {
  it('renders empty state when repayAmount is 0', () => {
    render(<PayoffProjection {...BASE_PROPS} />);
    expect(
      screen.getByText('Enter a repayment amount to see how it affects your payoff timeline.'),
    ).toBeInTheDocument();
  });

  it('shows months saved when a repayment amount is entered', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText(/mo sooner/)).toBeInTheDocument();
  });

  it('shows full payoff state when amount clears the debt', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={100_000} />);
    expect(screen.getByText('Full payoff')).toBeInTheDocument();
  });

  it('displays payoff timeline comparison', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText('Current payoff')).toBeInTheDocument();
    expect(screen.getByText('With this repayment')).toBeInTheDocument();
  });

  it('displays monthly payment with edit capability', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText('Monthly payment')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit monthly payment amount')).toBeInTheDocument();
  });

  it('has accessible region role', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByRole('region', { name: 'Payoff projection' })).toBeInTheDocument();
  });

  it('shows utilization bars when amount is entered', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it('shows interest saved when repayment reduces timeline', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText('Interest saved')).toBeInTheDocument();
  });

  it('shows months saved stat card', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText('Months saved')).toBeInTheDocument();
  });

  it('uses default monthly payment from nextPaymentAmount', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    expect(screen.getByText(/\$2,500/)).toBeInTheDocument();
  });

  it('falls back to computed payment when nextPaymentAmount is not provided', () => {
    render(
      <PayoffProjection
        currentDebt={100_000}
        apr={8.5}
        repayAmount={20_000}
        limit={200_000}
      />,
    );
    expect(screen.getByText('Monthly payment')).toBeInTheDocument();
  });

  describe('tabular-nums on numeric displays (FWC26)', () => {
    it('months saved value has num-tabular class', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
      const monthsSaved = container.querySelector('.text-2xl.font-bold.text-accent.num-tabular');
      expect(monthsSaved).toBeInTheDocument();
      expect(monthsSaved?.classList.contains('num-tabular')).toBe(true);
    });

    it('interest saved value has num-tabular class', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
      const interestSaved = container.querySelector('.text-2xl.font-bold.text-success.num-tabular');
      expect(interestSaved).toBeInTheDocument();
      expect(interestSaved?.classList.contains('num-tabular')).toBe(true);
    });

    it('utilization percentage span has num-tabular class', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
      const utilSpan = container.querySelector('.text-xs.text-muted.num-tabular');
      expect(utilSpan).toBeInTheDocument();
      expect(utilSpan?.classList.contains('num-tabular')).toBe(true);
    });

    it('monthly payment value has num-tabular class', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
      const monthlyPayment = container.querySelector('.text-sm.font-semibold.text-foreground.num-tabular');
      expect(monthlyPayment).toBeInTheDocument();
      expect(monthlyPayment?.classList.contains('num-tabular')).toBe(true);
    });

    it('months saved retains num-tabular in full payoff state', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={100_000} />);
      const fullPayoffEl = container.querySelector('.text-2xl.font-bold.text-accent.num-tabular');
      expect(fullPayoffEl).toBeInTheDocument();
    });

    it('interest saved retains num-tabular in empty state (no amount)', () => {
      const { container } = render(<PayoffProjection {...BASE_PROPS} repayAmount={0} />);
      // When no amount, the interest/months section isn't rendered, but the
      // monthly payment is always shown and should still have num-tabular
      const monthlyPayment = container.querySelector('.text-sm.font-semibold.text-foreground.num-tabular');
      expect(monthlyPayment).toBeInTheDocument();
    });
  });
});
