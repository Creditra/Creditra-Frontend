import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AutopayPage from './AutopayPage';

// Mock child components that are not the focus of this test
vi.mock('./AutoPayCard', () => ({
  AutoPayCard: ({ hasValidPreview }: { hasValidPreview: boolean }) => (
    <div data-testid="autopay-card">
      {hasValidPreview ? 'Preview ready' : 'No preview'}
    </div>
  ),
}));

describe('AutopayPage — optimistic UI', () => {
  it('shows success banner immediately on submit (optimistic)', async () => {
    render(<AutopayPage />);

    // Fill in the form with valid data
    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '500' },
    });

    const startDate = screen.getByLabelText(/start date/i);
    // Use a future date
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureDateStr = future.toISOString().split('T')[0];
    fireEvent.change(startDate, { target: { value: futureDateStr } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    // The success banner should appear immediately (optimistic)
    expect(screen.getByText(/autopay activated/i)).toBeInTheDocument();
  });

  it('disables the cancel button while submitting', async () => {
    render(<AutopayPage />);

    // Fill in the form with valid data
    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '500' },
    });

    const startDate = screen.getByLabelText(/start date/i);
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureDateStr = future.toISOString().split('T')[0];
    fireEvent.change(startDate, { target: { value: futureDateStr } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    // Cancel button should be disabled while submitting
    expect(screen.getByRole('button', { name: /cancel autopay/i })).toBeDisabled();
  });

  it('sets aria-busy on the form while submitting', async () => {
    render(<AutopayPage />);

    // Fill in the form with valid data
    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '500' },
    });

    const startDate = screen.getByLabelText(/start date/i);
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureDateStr = future.toISOString().split('T')[0];
    fireEvent.change(startDate, { target: { value: futureDateStr } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    // The form should have aria-busy="true"
    const form = screen.getByRole('form', { name: /autopay schedule configuration/i });
    expect(form).toHaveAttribute('aria-busy', 'true');
  });

  it('shows PendingButton with Activating… label while submitting', async () => {
    render(<AutopayPage />);

    // Fill in the form with valid data
    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: '500' },
    });

    const startDate = screen.getByLabelText(/start date/i);
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureDateStr = future.toISOString().split('T')[0];
    fireEvent.change(startDate, { target: { value: futureDateStr } });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    // The button should show "Activating…" while submitting
    expect(screen.getByRole('button', { name: /activating/i })).toBeInTheDocument();
  });
});