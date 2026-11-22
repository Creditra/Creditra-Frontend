import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReducedMotionProvider } from '../../context/ReducedMotionContext';
import { DashboardDataProvider, useDashboardDataContext } from '../useDashboardData';
import { renderWithCredit } from '../../test/renderWithCredit';
import type { CreditLine } from '../../types/creditLine';

const line: CreditLine = {
  id: 'cl-dashboard-hook',
  name: 'Dashboard Hook Line',
  status: 'Active',
  limit: 1_000,
  utilized: 250,
  apr: 8,
  riskScore: 700,
  openedAt: '2025-01-01',
  updatedAt: '2025-01-01T00:00:00Z',
  transactions: [],
  statusHistory: [{ status: 'Active', date: '2025-01-01' }],
};

function DashboardDataProbe() {
  const { status, creditLines, totalUtilized, activeLinesOnly } =
    useDashboardDataContext();

  return (
    <output data-testid="dashboard-data">
      {status}:{creditLines.length}:{totalUtilized}:{activeLinesOnly.length}
    </output>
  );
}

describe('useDashboardData', () => {
  it('exposes loaded lines and derived summary values to dashboard sections', async () => {
    renderWithCredit(
      <ReducedMotionProvider>
        <DashboardDataProvider>
          <DashboardDataProbe />
        </DashboardDataProvider>
      </ReducedMotionProvider>,
      { lines: [line] },
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-data')).toHaveTextContent(
        'success:1:250:1',
      );
    });
  });
});
