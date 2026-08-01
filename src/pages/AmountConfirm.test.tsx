import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AmountConfirm } from './AmountConfirm';

describe('AmountConfirm', () => {
  it('renders the formatted amount and instruction', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    expect(screen.getByText('$5,000')).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === 'p' &&
          element?.textContent?.includes('Type $5,000 to confirm this action.')
        );
      }),
    ).toBeInTheDocument();
  });

  it('marks confirm button aria-disabled when input does not match', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Confirm' });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('enables confirm button when input matches the amount', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    const input = screen.getByLabelText(/Type the amount to confirm/i);
    fireEvent.change(input, { target: { value: '5000' } });
    const btn = screen.getByRole('button', { name: 'Confirm' });
    expect(btn).toHaveAttribute('aria-disabled', 'false');
  });

  it('calls onConfirm when the form is submitted with matching input', () => {
    const onConfirm = vi.fn();
    render(<AmountConfirm amount={100} onConfirm={onConfirm} />);
    const input = screen.getByLabelText(/Type the amount to confirm/i);
    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows error when submitted with non-matching input', () => {
    const onConfirm = vi.fn();
    render(<AmountConfirm amount={100} onConfirm={onConfirm} />);
    const input = screen.getByLabelText(/Type the amount to confirm/i);
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders cancel button when onCancel is provided', () => {
    const onCancel = vi.fn();
    render(
      <AmountConfirm amount={5000} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses custom confirm label', () => {
    render(
      <AmountConfirm amount={5000} onConfirm={vi.fn()} confirmLabel="Approve" />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  // ─── LiveRegion tests ────────────────────────────────────────────────────

  it('renders a LiveRegion with sr-only class for SR announcements', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveClass('sr-only');
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('announces confirmation message when amount matches', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    const input = screen.getByLabelText(/Type the amount to confirm/i);
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toHaveTextContent('Amount confirmed: $5,000');
  });

  it('announces error message when amount does not match', () => {
    render(<AmountConfirm amount={5000} onConfirm={vi.fn()} />);
    const input = screen.getByLabelText(/Type the amount to confirm/i);
    fireEvent.change(input, { target: { value: '4999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    const liveRegion = document.querySelector('[role="status"]');
    expect(liveRegion).toHaveTextContent(
      /Amount does not match.*type exactly 5000/i,
    );
  });
});
