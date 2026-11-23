import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreditReport } from './CreditReport';
import type { UseCreditLinesResult } from '../hooks/useCreditLines';
import type { CreditLine } from '../types/creditLine';

const mockUseCreditLines = vi.fn<() => UseCreditLinesResult>();

vi.mock('../hooks/useCreditLines', () => ({
  useCreditLines: () => mockUseCreditLines(),
}));

const SAMPLE_WALLET = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRS';

function makeLine(overrides: Partial<CreditLine> = {}): CreditLine {
  return {
    id: 'line-1',
    name: 'Builder Credit Line',
    status: 'Active',
    limit: 10000,
    utilized: 4000,
    apr: 8.5,
    riskScore: 760,
    openedAt: '2025-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    statusHistory: [{ status: 'Active', date: '2025-01-15T10:00:00Z' }],
    transactions: [
      {
        id: 'tx-1',
        type: 'Repay',
        amount: 500,
        date: '2026-01-10T10:00:00Z',
        status: 'Completed',
        note: 'Monthly repayment',
      },
      {
        id: 'tx-2',
        type: 'Draw',
        amount: 4000,
        date: '2025-12-01T10:00:00Z',
        status: 'Completed',
      },
    ],
    ...overrides,
  };
}

function makeHookResult(overrides: Partial<UseCreditLinesResult> = {}): UseCreditLinesResult {
  return {
    status: 'success',
    lines: [],
    error: null,
    refetch: vi.fn().mockResolvedValue([]),
    lastUpdatedAt: new Date('2026-01-15T12:00:00Z'),
    owner: SAMPLE_WALLET,
    wallet: {
      publicKey: SAMPLE_WALLET,
      type: 'freighter',
      network: 'TESTNET',
    },
    setLines: vi.fn(),
    ...overrides,
  };
}

describe('CreditReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when there are no credit lines', () => {
    mockUseCreditLines.mockReturnValue(makeHookResult({ lines: [] }));

    render(<CreditReport />);

    expect(screen.getByTestId('credit-report-empty')).toBeInTheDocument();
    expect(screen.getByText(/no credit lines found/i)).toBeInTheDocument();
    expect(screen.getByTestId('credit-report-wallet')).toHaveTextContent('GABCDE…PQRS');
  });

  it('renders summary, per-line table, risk score, and repayment record', () => {
    const activeLine = makeLine();
    const suspendedLine = makeLine({
      id: 'line-2',
      name: 'Working Capital Line',
      status: 'Suspended',
      limit: 5000,
      utilized: 2000,
      apr: 12.25,
      riskScore: 620,
      statusHistory: [
        { status: 'Active', date: '2025-02-01T00:00:00Z' },
        { status: 'Suspended', date: '2026-01-01T00:00:00Z' },
      ],
      transactions: [
        {
          id: 'tx-late',
          type: 'Repay',
          amount: 250,
          date: '2026-01-12T10:00:00Z',
          status: 'Completed',
          note: 'Late payment',
        },
      ],
    });

    mockUseCreditLines.mockReturnValue(
      makeHookResult({ lines: [activeLine, suspendedLine] }),
    );

    render(<CreditReport />);

    // Header metadata
    expect(screen.getByRole('heading', { name: /credit report/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('credit-report-wallet')).toHaveTextContent('GABCDE…PQRS');
    expect(screen.getByText(/generated:/i)).toBeInTheDocument();

    // Sections
    expect(screen.getByRole('heading', { name: /portfolio summary/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /credit lines breakdown/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /risk score/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /repayment record/i })).toBeInTheDocument();

    // Repayment counts
    expect(screen.getByTestId('repayment-on-time-count')).toHaveTextContent('1');
    expect(screen.getByTestId('repayment-late-count')).toHaveTextContent('1');

    // Accessible tables: every table has a <caption> and <th scope="col"> / <th scope="row">
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThanOrEqual(3);
    for (const table of tables) {
      expect(table.querySelector('caption')).not.toBeNull();
      expect(table.querySelectorAll('th[scope="col"]').length).toBeGreaterThan(0);
      expect(table.querySelectorAll('th[scope="row"]').length).toBeGreaterThan(0);
    }
  });

  it('triggers window.print when Print Report button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    mockUseCreditLines.mockReturnValue(makeHookResult({ lines: [makeLine()] }));

    render(<CreditReport />);

    const printButton = screen.getByRole('button', { name: /print report/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
