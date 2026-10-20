import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RepaymentVisualizer } from './RepaymentVisualizer';
import { ReducedMotionProvider } from '@/context/ReducedMotionContext';

describe('RepaymentVisualizer', () => {
  it('renders without crashing on valid inputs', () => {
    render(
      <ReducedMotionProvider>
        <RepaymentVisualizer
          principal={10000}
          apr={5}
          monthlyPayment={300}
        />
      </ReducedMotionProvider>
    );
    expect(screen.getByText('Repayment Plan')).toBeInTheDocument();
  });

  it('renders themed EmptyState when inputs are missing or zero', () => {
    render(
      <ReducedMotionProvider>
        <RepaymentVisualizer
          principal={0}
          apr={0}
          monthlyPayment={0}
        />
      </ReducedMotionProvider>
    );
    expect(screen.getAllByText('Enter a valid principal, APR, and monthly payment to see the repayment plan.')[0]).toBeInTheDocument();
  });

  it('announces status changes via a polite aria-live region', () => {
    const { rerender } = render(
      <ReducedMotionProvider>
        <RepaymentVisualizer
          principal={0}
          apr={0}
          monthlyPayment={0}
        />
      </ReducedMotionProvider>
    );

    const liveRegion = screen.getByRole('status');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveTextContent('Enter a valid principal, APR, and monthly payment to see the repayment plan.');

    rerender(
      <ReducedMotionProvider>
        <RepaymentVisualizer
          principal={10000}
          apr={5}
          monthlyPayment={300}
        />
      </ReducedMotionProvider>
    );

    // After updating to valid inputs, it should announce the schedule
    expect(liveRegion).toHaveTextContent(/Repayment plan updated: 36 months, \$789 total interest\./);
  });
});
