import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AffordabilityCalc, calcMaxAffordable, parseStrictAmount, DEBT_RATIO } from './AffordabilityCalc';

// ─── parseStrictAmount ───────────────────────────────────────────────────────

describe('parseStrictAmount', () => {
  it('parses a plain integer', () => {
    expect(parseStrictAmount('5000')).toBe(5000);
  });

  it('parses a value with one decimal place', () => {
    expect(parseStrictAmount('5000.5')).toBe(5000.5);
  });

  it('parses a value with two decimal places', () => {
    expect(parseStrictAmount('1200.50')).toBe(1200.5);
  });

  it('parses zero', () => {
    expect(parseStrictAmount('0')).toBe(0);
  });

  it('rejects "12abc"', () => {
    expect(parseStrictAmount('12abc')).toBeNull();
  });

  it('rejects scientific notation "1e3"', () => {
    expect(parseStrictAmount('1e3')).toBeNull();
  });

  it('rejects a negative value "-5"', () => {
    expect(parseStrictAmount('-5')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(parseStrictAmount('')).toBeNull();
  });

  it('rejects whitespace-only input', () => {
    expect(parseStrictAmount('   ')).toBeNull();
  });

  it('rejects three decimal places', () => {
    expect(parseStrictAmount('1.123')).toBeNull();
  });

  it('rejects a value starting with a decimal point', () => {
    expect(parseStrictAmount('.5')).toBeNull();
  });
});

// ─── calcMaxAffordable ───────────────────────────────────────────────────────

describe('calcMaxAffordable', () => {
  it('applies the 36 % debt ratio', () => {
    expect(calcMaxAffordable(10000, 0)).toBeCloseTo(10000 * DEBT_RATIO);
  });

  it('subtracts existing obligations', () => {
    expect(calcMaxAffordable(10000, 1000)).toBeCloseTo(10000 * DEBT_RATIO - 1000);
  });

  it('clamps to 0 when obligations exceed the cap', () => {
    expect(calcMaxAffordable(1000, 5000)).toBe(0);
  });

  it('returns 0 for zero income', () => {
    expect(calcMaxAffordable(0, 0)).toBe(0);
  });
});

// ─── AffordabilityCalc component ─────────────────────────────────────────────

function renderCalc(onApply?: (n: number) => void) {
  return render(<AffordabilityCalc onApply={onApply} />);
}

describe('AffordabilityCalc component', () => {
  it('renders income and obligations inputs', () => {
    renderCalc();
    expect(screen.getByLabelText(/monthly income/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monthly obligations/i)).toBeInTheDocument();
  });

  it('does not show a result before income is entered', () => {
    renderCalc();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the result after valid income is entered', () => {
    renderCalc();
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '10000' },
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/max affordable repayment/i)).toBeInTheDocument();
  });

  it('computes the correct max affordable amount', () => {
    renderCalc();
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByLabelText(/monthly obligations/i), {
      target: { value: '1000' },
    });
    // 10000 * 0.36 - 1000 = 2600
    expect(screen.getByRole('status')).toHaveTextContent('$2,600');
  });

  it('shows $0 when obligations exceed the DTI cap', () => {
    renderCalc();
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText(/monthly obligations/i), {
      target: { value: '5000' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('$0');
  });

  it('renders "Use this amount" button when onApply is provided', () => {
    renderCalc(vi.fn());
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '10000' },
    });
    expect(screen.getByRole('button', { name: /use this amount/i })).toBeInTheDocument();
  });

  it('does not render "Use this amount" button without onApply', () => {
    renderCalc();
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '10000' },
    });
    expect(screen.queryByRole('button', { name: /use this amount/i })).not.toBeInTheDocument();
  });

  it('calls onApply with the computed max when the button is clicked', () => {
    const onApply = vi.fn();
    renderCalc(onApply);
    fireEvent.change(screen.getByLabelText(/monthly income/i), {
      target: { value: '10000' },
    });
    fireEvent.change(screen.getByLabelText(/monthly obligations/i), {
      target: { value: '1000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use this amount/i }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith(2600);
  });

  it('has a visible focus ring class on inputs', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    expect(incomeInput.className).toContain('focus:ring-2');
    expect(incomeInput.className).toContain('focus:ring-accent');
  });

  it('has the tooltip trigger in the document', () => {
    renderCalc();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  // ── Strict parser – invalid input rejection ────────────────────────────────

  it('shows an error and no result for "12abc" after blur', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '12abc' } });
    fireEvent.blur(incomeInput);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an error and no result for scientific notation "1e3" after blur', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '1e3' } });
    fireEvent.blur(incomeInput);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows an error and no result for a negative value "-500" after blur', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '-500' } });
    fireEvent.blur(incomeInput);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks the income input aria-invalid on bad input after blur', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '12abc' } });
    fireEvent.blur(incomeInput);
    expect(incomeInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not show an error for a valid two-decimal amount', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '5000.75' } });
    fireEvent.blur(incomeInput);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not show an error while typing (before blur)', () => {
    renderCalc();
    const incomeInput = screen.getByLabelText(/monthly income/i);
    fireEvent.change(incomeInput, { target: { value: '12abc' } });
    // No blur — error must stay hidden while typing
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
