import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmountInput } from './AmountInput';

describe('AmountInput', () => {
  const creditLine = {
    id: 'cl-001',
    name: 'Business Line of Credit',
    limit: 50000,
    available: 35000,
    utilization: 30,
  };

  it('connects inline validation messaging to the input with aria-describedby', () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/amount to draw/i);
    expect(input).toHaveAttribute(
      'aria-describedby',
      'draw-amount-helper draw-amount-constraints draw-amount-status',
    );
  });

  it('shows an inline error and keeps continue disabled when the amount exceeds availability', () => {
    render(
      <AmountInput
        creditLine={creditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/amount to draw/i), {
      target: { value: '36000' },
    });

    expect(screen.getByText('Exceeds available credit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });
});
