import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CreditLines from '../CreditLines';
import { renderWithCredit } from '../../test/renderWithCredit';
import type { CreditDataSource } from '../../services/credit/CreditDataSource';
import type { CreditLine } from '../../types/creditLine';

const TEST_LINES: CreditLine[] = [{
  id: 'CL-001',
  name: 'Test Active Line',
  status: 'Active',
  limit: 100000,
  utilized: 0,
  apr: 8.5,
  riskScore: 700,
  collateral: 'ETH',
  openedAt: '2025-01-01',
  updatedAt: '2025-06-01T00:00:00Z',
  transactions: [],
  statusHistory: [],
}];

function source(): CreditDataSource {
  return {
    listCreditLines: vi.fn().mockResolvedValue(TEST_LINES),
    getCreditLine: vi.fn(),
  };
}

function renderCreditLines() {
  return renderWithCredit(<CreditLines />, { source: source() });
}

async function getStatusSelect() {
  return (await screen.findAllByRole('combobox'))[0];
}

describe('CreditLines — empty state (issue #313)', () => {
  describe('no filter results', () => {
    it('shows no-matches guidance when filter excludes all lines', async () => {
      const user = userEvent.setup();
      renderCreditLines();
      await user.selectOptions(await getStatusSelect(), 'Defaulted');
      expect(await screen.findByText('No matching credit lines')).toBeInTheDocument();
    });

    it('renders the Clear Filters button when no matches', async () => {
      const user = userEvent.setup();
      renderCreditLines();
      await user.selectOptions(await getStatusSelect(), 'Defaulted');
      expect(await screen.findByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
    });

    it('clears filters when Clear Filters is clicked', async () => {
      const user = userEvent.setup();
      renderCreditLines();
      await user.selectOptions(await getStatusSelect(), 'Defaulted');
      await user.click(await screen.findByRole('button', { name: 'Clear Filters' }));
      expect(await screen.findByText('Test Active Line')).toBeInTheDocument();
    });

    it('sets the region aria-label for accessibility', async () => {
      const user = userEvent.setup();
      renderCreditLines();
      await user.selectOptions(await getStatusSelect(), 'Defaulted');
      expect(await screen.findByRole('region', { name: 'No matching credit lines' })).toBeInTheDocument();
    });
  });
});
