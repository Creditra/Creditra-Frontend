import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreditLines from '../CreditLines';
import { renderWithCredit } from '../../test/renderWithCredit';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditLine } from '../../types/creditLine';
import type { CreditDataSource } from '../../services/credit/CreditDataSource';

function pendingSource(): CreditDataSource {
  return {
    listCreditLines: vi.fn(() => new Promise<CreditLine[]>(() => undefined)),
    getCreditLine: vi.fn(),
  };
}

describe('CreditLines loading skeleton', () => {
  it('shows placeholders with an accessible busy region while source data is pending', () => {
    const { container } = renderWithCredit(<CreditLines />, { source: pendingSource() });

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    expect(screen.getByRole('status', { name: 'Loading credit lines' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('uses the responsive credit-line grid skeleton', () => {
    const { container } = renderWithCredit(<CreditLines />, { source: pendingSource() });
    const grid = container.querySelector('.cl-grid');

    expect(grid).toBeInTheDocument();
    expect(grid?.querySelectorAll('.cl-card').length).toBeGreaterThan(0);
  });

  it('replaces the skeleton with source data when loading succeeds', async () => {
    renderWithCredit(<CreditLines />, {
      source: {
        listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
        getCreditLine: vi.fn(),
      },
    });

    expect(await screen.findByRole('heading', { name: 'Credit Lines' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading credit lines' })).not.toBeInTheDocument());
  });
});
