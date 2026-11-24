import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TypedAmountConfirm,
  TypedAmountConfirmField,
  parseTypedAmount,
  isTypedAmountMatch,
  shouldRequireTypedAmountConfirm,
} from './TypedAmountConfirm';

vi.mock('../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('../hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe('typed amount helpers', () => {
  describe('parseTypedAmount', () => {
    it('returns 0 for empty string', () => {
      expect(parseTypedAmount('')).toBe(0);
    });

    it('returns 0 for non-numeric input', () => {
      expect(parseTypedAmount('abc')).toBe(0);
    });

    it('parses a plain integer string', () => {
      expect(parseTypedAmount('5000')).toBe(5000);
    });

    it('parses a decimal string', () => {
      expect(parseTypedAmount('5000.50')).toBe(5000.5);
    });

    it('returns 0 for a currency-formatted string with $ prefix', () => {
      // "$5000" → NaN via parseFloat → 0, enforcing raw-digit-only entry.
      expect(parseTypedAmount('$5000')).toBe(0);
    });

    it('returns 0 for a comma-formatted value like "5,000"', () => {
      // Strict parsing rejects commas — the hint text explains raw digits are required.
      expect(parseTypedAmount('5,000')).toBe(0);
    });

    it('rejects trailing garbage and scientific notation ("12abc", "1e3")', () => {
      expect(parseTypedAmount('12abc')).toBe(0);
      expect(parseTypedAmount('1e3')).toBe(0);
      expect(isTypedAmountMatch('12abc', 12)).toBe(false);
      expect(isTypedAmountMatch('1e3', 1000)).toBe(false);
    });

    it('returns 0 for whitespace-only input', () => {
      expect(parseTypedAmount('   ')).toBe(0);
    });

    it('handles a trailing decimal point gracefully', () => {
      // "5000." is a valid partial entry — parseFloat yields 5000.
      expect(parseTypedAmount('5000.')).toBe(5000);
    });
  });

  describe('isTypedAmountMatch', () => {
    it('returns true for exact integer match', () => {
      expect(isTypedAmountMatch('5000', 5000)).toBe(true);
    });

    it('returns true when typed value includes trailing zeroes', () => {
      expect(isTypedAmountMatch('5000.00', 5000)).toBe(true);
    });

    it('returns false for a value that is off by one cent', () => {
      expect(isTypedAmountMatch('4999.99', 5000)).toBe(false);
    });

    it('returns true for a decimal amount match', () => {
      expect(isTypedAmountMatch('5000.50', 5000.5)).toBe(true);
    });

    it('returns false for comma-formatted values even when numerically close', () => {
      // "5,000" parses to 5, not 5000 — never a match.
      expect(isTypedAmountMatch('5,000', 5000)).toBe(false);
    });

    it('returns false for an empty string (parseTypedAmount returns 0)', () => {
      expect(isTypedAmountMatch('', 5000)).toBe(false);
    });
  });

  describe('shouldRequireTypedAmountConfirm', () => {
    it('returns false just below the threshold (4999.99)', () => {
      expect(shouldRequireTypedAmountConfirm(4999.99)).toBe(false);
    });

    it('returns true at exactly the threshold (5000)', () => {
      expect(shouldRequireTypedAmountConfirm(5000)).toBe(true);
    });

    it('returns true above the threshold (5001)', () => {
      expect(shouldRequireTypedAmountConfirm(5001)).toBe(true);
    });

    it('returns false below the threshold (1)', () => {
      expect(shouldRequireTypedAmountConfirm(1)).toBe(false);
    });
  });
});

// ─── TypedAmountConfirmField ──────────────────────────────────────────────────

describe('TypedAmountConfirmField', () => {
  it('renders a labelled input with hint text', () => {
    render(
      <TypedAmountConfirmField amount={7500} value="" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('Type the repayment amount to confirm')).toBeInTheDocument();
    expect(screen.getByText(/Type the repayment amount \(\$7,500.00\)/)).toBeInTheDocument();
  });

  it('uses type="text" and inputMode="decimal" (no browser numeric spin-button)', () => {
    render(
      <TypedAmountConfirmField amount={5000} value="" onChange={vi.fn()} />,
    );

    const input = screen.getByLabelText('Type the repayment amount to confirm');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('shows "Type the amount above" helper when no value has been entered', () => {
    render(
      <TypedAmountConfirmField amount={5000} value="" onChange={vi.fn()} />,
    );

    expect(screen.getByText('Type the amount above to enable confirmation.')).toBeInTheDocument();
    // No live-region status message while the field is pristine.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('marks input invalid and shows mismatch helper when value does not match', () => {
    render(
      <TypedAmountConfirmField amount={5000} value="1234" onChange={vi.fn()} />,
    );

    const input = screen.getByLabelText('Type the repayment amount to confirm');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Amount does not match');
  });

  it('marks input valid and shows confirmed helper when value matches', () => {
    render(
      <TypedAmountConfirmField amount={5000} value="5000" onChange={vi.fn()} />,
    );

    const input = screen.getByLabelText('Type the repayment amount to confirm');
    // aria-invalid is explicitly the boolean false (renders as string "false") when valid.
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Amount confirmed.');
  });

  it('accepts a decimal amount match', () => {
    render(
      <TypedAmountConfirmField amount={5000.5} value="5000.5" onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('Type the repayment amount to confirm')).toHaveAttribute(
      'aria-invalid',
      'false',
    );
  });

  it('fires onChange when the user types a character', async () => {
    const onChange = vi.fn();
    render(
      <TypedAmountConfirmField amount={5000} value="" onChange={onChange} />,
    );

    // Type a single character into the controlled field; onChange should fire.
    await userEvent.type(
      screen.getByLabelText('Type the repayment amount to confirm'),
      '5',
    );

    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('respects a custom idPrefix so multiple fields can coexist on one page', () => {
    render(
      <TypedAmountConfirmField
        amount={5000}
        value=""
        onChange={vi.fn()}
        idPrefix="review-step"
      />,
    );

    expect(document.getElementById('review-step-input')).toBeInTheDocument();
    expect(document.getElementById('review-step-hint')).toBeInTheDocument();
  });

  it('applies an additional className to the wrapper element', () => {
    const { container } = render(
      <TypedAmountConfirmField
        amount={5000}
        value=""
        onChange={vi.fn()}
        className="my-extra-class"
      />,
    );

    expect(container.firstChild).toHaveClass('typed-amount-confirm__field');
    expect(container.firstChild).toHaveClass('my-extra-class');
  });
});

// ─── TypedAmountConfirm modal ─────────────────────────────────────────────────

describe('TypedAmountConfirm modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Closed state ────────────────────────────────────────────────────────────

  it('renders nothing when closed', () => {
    const { container } = render(
      <TypedAmountConfirm
        isOpen={false}
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  // ── Open / structure ─────────────────────────────────────────────────────────

  it('renders dialog with aria-modal and the formatted amount when open', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Confirm large repayment')).toBeInTheDocument();
    expect(screen.getByText('$6,000.00')).toBeInTheDocument();
  });

  it('renders with custom title, description, and confirmLabel', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={9999}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Custom title"
        description="Custom description copy."
        confirmLabel="Approve Payment"
      />,
    );

    expect(screen.getByText('Custom title')).toBeInTheDocument();
    expect(screen.getByText('Custom description copy.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve Payment' })).toBeInTheDocument();
  });

  // ── Confirm button state ─────────────────────────────────────────────────────

  it('disables the confirm button while the typed value is empty', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Confirm Repayment' })).toBeDisabled();
  });

  it('keeps the confirm button disabled when the typed value is wrong', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // fireEvent.change directly sets the internal input's value
    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '1111' } },
    );

    expect(screen.getByRole('button', { name: 'Confirm Repayment' })).toBeDisabled();
  });

  it('enables confirm and calls onConfirm when the exact amount is typed', async () => {
    const onConfirm = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    // Use fireEvent.change to reliably set the controlled input value in jsdom
    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '6000' } },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Repayment' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('enables confirm for a decimal amount when typed exactly', async () => {
    const onConfirm = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={7500.5}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '7500.5' } },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Confirm Repayment' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // ── Cancel / dismiss ─────────────────────────────────────────────────────────

  it('calls onCancel when the Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the × close button is clicked', async () => {
    const onCancel = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Close confirmation dialog' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the overlay backdrop is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // The overlay is the outermost element; click it directly.
    const overlay = container.querySelector('.typed-amount-confirm-overlay')!;
    await userEvent.click(overlay);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onCancel when the dialog panel itself is clicked (stopPropagation)', async () => {
    const onCancel = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // A click on the dialog's inner element must not bubble to the overlay handler.
    await userEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // ── Pending state ────────────────────────────────────────────────────────────

  it('disables confirm and marks aria-busy when pending=true, even after a correct value is entered', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );

    // Type the correct amount to isolate the pending-state effect on the button.
    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '6000' } },
    );

    const confirmBtn = screen.getByRole('button', { name: 'Processing...' });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute('aria-busy', 'true');
  });

  it('hides the × close button while pending', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Close confirmation dialog' }),
    ).not.toBeInTheDocument();
  });

  it('disables the Cancel button while pending', () => {
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        pending
      />,
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('does NOT call onCancel when Escape is pressed while pending', () => {
    const onCancel = vi.fn();
    render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        pending
      />,
    );

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    // useFocusTrap receives onEscape=undefined when pending=true, so no dismiss.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does NOT call onCancel when backdrop is clicked while pending', async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={onCancel}
        pending
      />,
    );

    const overlay = container.querySelector('.typed-amount-confirm-overlay')!;
    await userEvent.click(overlay);
    expect(onCancel).not.toHaveBeenCalled();
  });

  // ── State lifecycle ──────────────────────────────────────────────────────────

  it('resets the typed value when closed and reopened', () => {
    const { rerender } = render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '1234' } },
    );
    expect(screen.getByLabelText('Type the repayment amount to confirm')).toHaveValue('1234');

    rerender(
      <TypedAmountConfirm
        isOpen={false}
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    rerender(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // After reopening the field must be empty (type="text" → value '').
    expect(screen.getByLabelText('Type the repayment amount to confirm')).toHaveValue('');
  });

  it('resets the typed value when the amount prop changes while open', () => {
    const { rerender } = render(
      <TypedAmountConfirm
        isOpen
        amount={6000}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByLabelText('Type the repayment amount to confirm'),
      { target: { value: '6000' } },
    );
    expect(screen.getByLabelText('Type the repayment amount to confirm')).toHaveValue('6000');

    // Simulate the parent changing the amount (e.g. user went back and edited).
    rerender(
      <TypedAmountConfirm
        isOpen
        amount={7500}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // The stale value must be cleared so the old amount cannot accidentally confirm.
    expect(screen.getByLabelText('Type the repayment amount to confirm')).toHaveValue('');
  });
});
