import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import CreditLines from '../CreditLines';
import { TransactionHistory } from '../TransactionHistory';
import RepayPage from '../RepayPage';
import { NotificationProvider } from '../../context/NotificationContext';
import { renderWithCredit } from '../../test/renderWithCredit';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditDataSource } from '../../services/credit/CreditDataSource';

function failingOnceSource(): CreditDataSource {
  return {
    listCreditLines: vi.fn()
      .mockRejectedValueOnce(new Error('Credit network unavailable'))
      .mockResolvedValue(MOCK_CREDIT_LINES),
    getCreditLine: vi.fn(),
  };
}

describe('credit-data page error recovery', () => {
  it.each([
    ['Dashboard', <Dashboard />, /Dashboard/],
    ['Credit Lines', <CreditLines />, /Manage your credit facilities/],
    [
      'Transactions',
      <NotificationProvider><TransactionHistory /></NotificationProvider>,
      /Transaction History/,
    ],
  ])('%s shows an alert and Retry reloads credit data', async (_page, page, recoveredContent) => {
    const source = failingOnceSource();
    renderWithCredit(page, { source, route: '/transactions' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Credit network unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText(recoveredContent)).toBeInTheDocument());
    expect(source.listCreditLines).toHaveBeenCalledTimes(2);
  });

  it('falls back to the credit-line picker for an unknown repay deep link', async () => {
    renderWithCredit(<RepayPage />, { route: '/repay?line=missing' });

    expect(await screen.findByRole('button', { name: /Primary Business Line/ })).toBeInTheDocument();
    expect(screen.queryByLabelText(/amount to repay/i)).not.toBeInTheDocument();
  });
});
