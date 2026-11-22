import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freezeTime, restoreTime } from '../../test/freezeTime';
import AutopayPage from '../AutopayPage';

const TODAY = '2026-06-15T12:00:00';

function renderPage() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <MemoryRouter>
      <AutopayPage />
    </MemoryRouter>,
  );
  return user;
}

describe('AutopayPage', () => {
  beforeEach(() => {
    freezeTime(TODAY);
  });

  afterEach(() => {
    vi.clearAllTimers();
    restoreTime();
  });

  it('shows empty amount and start-date errors and focuses the amount field', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    expect(screen.getByText('Enter a payment amount greater than $0.')).toBeInTheDocument();
    expect(screen.getByText('Select a start date for the autopay schedule.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Payment Amount/)).toHaveFocus();
  });

  it.each([
    ['zero', '0', 'Enter a payment amount greater than $0.'],
    ['negative', '-25', 'Enter a payment amount greater than $0.'],
    ['above the limit', '1000001', 'Amount cannot exceed $1,000,000 per payment.'],
  ])('rejects %s amounts', async (_case, amount, errorText) => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Payment Amount/), amount);
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    expect(screen.getByText(errorText)).toBeInTheDocument();
    expect(screen.getByLabelText(/Payment Amount/)).toHaveFocus();
  });

  it('rejects a non-numeric amount', async () => {
    const user = renderPage();
    const amount = screen.getByLabelText(/Payment Amount/) as HTMLInputElement;
    await user.type(amount, 'abc');
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    expect(screen.getByText('Enter a payment amount greater than $0.')).toBeInTheDocument();
  });

  it('rejects an end date that is not after the start date and focuses the end date', async () => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Payment Amount/), '100');
    await user.type(screen.getByLabelText(/Start Date/), '2026-06-20');
    await user.type(screen.getByLabelText(/End Date/), '2026-06-19');
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    expect(screen.getByText('End date must be after the start date.')).toBeInTheDocument();
    expect(screen.getByLabelText(/End Date/)).toHaveFocus();
  });

  it('rejects a start date in the past and focuses it', async () => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Payment Amount/), '100');
    await user.type(screen.getByLabelText(/Start Date/), '2026-06-14');
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    expect(screen.getByText('Start date cannot be in the past.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Date/)).toHaveFocus();
  });

  it('shows success feedback and hides it after editing a field', async () => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Payment Amount/), '250');
    await user.type(screen.getByLabelText(/Start Date/), '2026-06-20');
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(document.querySelector('.autopay-page__success-banner')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Autopay schedule saved successfully.',
    );

    await user.clear(screen.getByLabelText(/Payment Amount/));
    await user.type(screen.getByLabelText(/Payment Amount/), '300');

    expect(document.querySelector('.autopay-page__success-banner')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent(
      'Autopay schedule saved successfully.',
    );
  });

  it('clears a field error after editing that field', async () => {
    const user = renderPage();
    await user.click(screen.getByRole('button', { name: 'Activate Autopay' }));
    expect(screen.getByText('Enter a payment amount greater than $0.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Payment Amount/), '100');

    expect(screen.queryByText('Enter a payment amount greater than $0.')).not.toBeInTheDocument();
  });

  it('updates the schedule preview when the frequency changes', async () => {
    const user = renderPage();
    await user.type(screen.getByLabelText(/Payment Amount/), '125');
    await user.type(screen.getByLabelText(/Start Date/), '2026-06-20');

    expect(screen.getByText('Payment Schedule Preview')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: /Frequency/ }), 'biweekly');

    expect(screen.getByText('Every 2 weeks')).toBeInTheDocument();
  });
});
