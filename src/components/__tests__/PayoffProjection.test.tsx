import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getAccruedInterest, getAccruedInterestDays } from '@/lib/interest';
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

  describe('accrued interest to date', () => {
    it('omits the accrued interest row when new props are not provided', () => {
      render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
      expect(screen.queryByTestId('payoff-accrued-interest')).not.toBeInTheDocument();
      expect(screen.queryByText('Interest accrued to date')).not.toBeInTheDocument();
    });

    it('renders formatted amount, elapsed days, and ACT/365 basis by default', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          repayAmount={20_000}
          accruedInterest={77.5}
          accruedDays={31}
        />,
      );
      const row = screen.getByTestId('payoff-accrued-interest');
      expect(row).toHaveTextContent('Interest accrued to date');
      expect(row).toHaveTextContent('$77.50 (31 days, ACT/365)');
      expect(
        screen.getByRole('button', { name: 'About ACT/365 day-count convention' }),
      ).toBeInTheDocument();
    });

    it('uses singular day label when accruedDays is 1', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={2.5}
          accruedDays={1}
        />,
      );
      expect(screen.getByTestId('payoff-accrued-interest')).toHaveTextContent(
        '$2.50 (1 day, ACT/365)',
      );
    });

    it('updates label and amount consistently when dayCount is ACT/360', () => {
      const line = {
        utilized: 10_000,
        apr: 9.125,
        transactions: [{ type: 'Interest', date: '2025-01-01' }],
      };
      const now = new Date('2025-01-02T00:00:00Z');
      const days = getAccruedInterestDays(line, now);
      const act360Interest = getAccruedInterest(line, now, { dayCount: 'ACT/360' });

      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={act360Interest}
          accruedDays={days}
          dayCount="ACT/360"
        />,
      );

      expect(screen.getByTestId('payoff-accrued-interest')).toHaveTextContent(
        '$2.53 (1 day, ACT/360)',
      );
      expect(
        screen.getByRole('button', { name: 'About ACT/360 day-count convention' }),
      ).toBeInTheDocument();
    });

    it('handles leap-year elapsed day counts accurately', () => {
      const line = {
        utilized: 10_000,
        apr: 9.125,
        transactions: [{ type: 'Interest', date: '2024-02-01' }],
      };
      const now = new Date('2024-03-01T00:00:00Z');
      const days = getAccruedInterestDays(line, now);
      const interest = getAccruedInterest(line, now);

      expect(days).toBe(29);
      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={interest}
          accruedDays={days}
        />,
      );
      expect(screen.getByTestId('payoff-accrued-interest')).toHaveTextContent(
        '$72.50 (29 days, ACT/365)',
      );
    });

    it('hides the row when accruedDays is null', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={76.04}
          accruedDays={null}
        />,
      );
      expect(screen.queryByTestId('payoff-accrued-interest')).not.toBeInTheDocument();
    });

    it('hides the row when accruedInterest is 0 or 0 days elapsed', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={0}
          accruedDays={0}
        />,
      );
      expect(screen.queryByTestId('payoff-accrued-interest')).not.toBeInTheDocument();
    });

    it('hides the row when very small accrual rounds to $0.00', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          accruedInterest={0.001}
          accruedDays={1}
        />,
      );
      expect(screen.queryByTestId('payoff-accrued-interest')).not.toBeInTheDocument();
    });

    it('associates label with value accessibly and stays outside aria-live regions', () => {
      render(
        <PayoffProjection
          {...BASE_PROPS}
          repayAmount={20_000}
          accruedInterest={42.25}
          accruedDays={15}
        />,
      );
      const row = screen.getByTestId('payoff-accrued-interest');
      const dt = row.querySelector('dt');
      const dd = row.querySelector('dd');
      expect(dt?.id).toBeTruthy();
      expect(dd?.getAttribute('aria-labelledby')).toBe(dt?.id);
      expect(row.closest('[aria-live]')).toBeNull();
      expect(row.querySelector('[aria-live]')).toBeNull();
    });
  });

  it('rejects invalid monthly payment strings like "12abc" and "1e3"', () => {
    render(<PayoffProjection {...BASE_PROPS} repayAmount={20_000} />);
    fireEvent.click(screen.getByLabelText('Edit monthly payment amount'));
    const input = screen.getByLabelText('Assumed monthly payment');

    fireEvent.change(input, { target: { value: '12abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // Should fall back to default monthly payment ($2,500), not $12
    expect(screen.getByText(/\$2,500/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Edit monthly payment amount'));
    fireEvent.change(screen.getByLabelText('Assumed monthly payment'), {
      target: { value: '1e3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // Should still fall back to default monthly payment ($2,500), not $1,000
    expect(screen.getByText(/\$2,500/)).toBeInTheDocument();
  });
});
