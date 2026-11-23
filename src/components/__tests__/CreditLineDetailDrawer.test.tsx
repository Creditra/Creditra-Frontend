import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreditLineDetailDrawer } from '../CreditLineDetailDrawer';
import type { CreditLine } from '../../types/creditLine';

// Mock hooks to avoid layout side-effects in test environment
vi.mock('../../hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('../../hooks/useInertBackdrop', () => ({
  useInertBackdrop: vi.fn(),
}));

describe('CreditLineDetailDrawer', () => {
  const mockOnClose = vi.fn();

  const mockCreditLine: CreditLine = {
    id: 'CL-TEST-001',
    name: 'Test Business Facility',
    status: 'Active',
    limit: 100000,
    utilized: 40000,
    apr: 8.5,
    riskScore: 710,
    collateral: 'Accounts Receivable',
    openedAt: '2024-03-15',
    updatedAt: '2025-02-20T14:32:00Z',
    nextPaymentDate: '2025-03-01',
    nextPaymentAmount: 1500,
    transactions: [
      {
        id: 'TX-TEST-001',
        type: 'Draw',
        amount: 40000,
        date: '2025-02-18T10:30:00Z',
        note: 'Purchase inventory',
        status: 'Completed',
        txHash: '0xabc123',
      },
      {
        id: 'TX-TEST-002',
        type: 'Repay',
        amount: 10000,
        date: '2025-02-10T14:15:00Z',
        note: 'Repayment',
        status: 'Completed',
      },
    ],
    statusHistory: [
      { status: 'Active', date: '2024-03-15', note: 'Line opened' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderDrawer = (line: CreditLine = mockCreditLine) =>
    render(
      <MemoryRouter>
        <CreditLineDetailDrawer line={line} onClose={mockOnClose} />
      </MemoryRouter>
    );

  it('renders credit line details correctly', () => {
    renderDrawer();

    // Renders header information
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Test Business Facility')).toBeInTheDocument();
    expect(screen.getByText('CL-TEST-001')).toBeInTheDocument();

    // Renders badge
    expect(screen.getByLabelText('Credit line status: Active')).toBeInTheDocument();

    // Renders key metrics
    // $100,000 limit, $40,000 utilized, $60,000 available
    expect(screen.getByText('$100,000')).toBeInTheDocument();
    expect(screen.getByText('$40,000')).toBeInTheDocument();
    expect(screen.getByText('$60,000')).toBeInTheDocument();
    expect(screen.getByText('8.50% APR')).toBeInTheDocument();

    // Renders progress bar level
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');

    // Facility details
    expect(screen.getByText('710')).toBeInTheDocument();
    expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();

    // Action links
    expect(screen.getByRole('link', { name: /Repay/i })).toHaveAttribute('href', '/repay?line=CL-TEST-001');
    expect(screen.getByRole('link', { name: /Draw Credit/i })).toHaveAttribute('href', '/draw-credit?line=CL-TEST-001');
    expect(screen.getByRole('link', { name: /Transactions/i })).toHaveAttribute('href', '/transactions?line=CL-TEST-001');
  });

  it('renders inline SVG sparkline and transaction history', () => {
    renderDrawer();

    // Sparkline trend is rendered
    expect(screen.getByLabelText('Sparkline showing credit line balance history')).toBeInTheDocument();

    // Transactions list
    expect(screen.getAllByText('Draw').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Repay').length).toBeGreaterThan(0);
    expect(screen.getByText('Purchase inventory')).toBeInTheDocument();
    expect(screen.getByText('-$40,000')).toBeInTheDocument();
    expect(screen.getByText('+$10,000')).toBeInTheDocument();
  });

  it('renders activity timeline and empty states when chart histories are absent', () => {
    renderDrawer();

    // Activity timeline combines transactions + statusHistory
    expect(screen.getByRole('list', { name: /User activity timeline/i })).toBeInTheDocument();
    expect(screen.getByText(/Status: Active — Line opened/i)).toBeInTheDocument();

    // Graceful empty states when aprHistory and healthHistory are missing
    expect(screen.getByText(/No APR history available/i)).toBeInTheDocument();
    expect(screen.getByText(/No health factor history available/i)).toBeInTheDocument();
  });

  it('renders APR and Health Factor charts when fixture data exists', () => {
    renderDrawer({
      ...mockCreditLine,
      aprHistory: [
        { date: '2025-01-01', apr: 8.2 },
        { date: '2025-02-01', apr: 8.5 },
      ],
      healthHistory: [
        { date: '2025-01-01', value: 2.4 },
        { date: '2025-02-01', value: 2.5 },
      ],
    });

    expect(screen.queryByText(/No APR history available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No health factor history available/i)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /APR history time window/i })).toBeInTheDocument();
  });

  it('calls onClose when clicking the close button', () => {
    renderDrawer();

    const closeBtn = screen.getByLabelText('Close details drawer');
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    renderDrawer();

    // Fire keydown Escape on document/dialog container
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    // FocusTrap handles Escape internally and should trigger onClose
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
