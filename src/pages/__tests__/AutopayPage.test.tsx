import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AutopayPage from '../AutopayPage';
import type { CreditLine } from '../../types/creditLine';
import { SETTLEMENT_ASSET } from '../../lib/repayable-balance';

const { state } = vi.hoisted(() => ({
  state: {
    lines: [] as CreditLine[],
    balances: [] as Array<{ asset: string; balance: string; issuer?: string }>,
  },
}));

vi.mock('../../hooks/useCreditLines', () => ({
  useCreditLines: () => ({
    status: 'success',
    lines: state.lines,
    error: null,
    refetch: vi.fn(),
    lastUpdatedAt: null,
    owner: 'GTEST',
    wallet: null,
    setLines: vi.fn(),
  }),
}));

vi.mock('../../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GTEST', network: 'TESTNET' },
    status: 'connected',
    balances: state.balances,
  }),
}));

function creditLine(overrides: Partial<CreditLine> & { id: string }): CreditLine {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Line ${id}`,
    status: 'Active',
    limit: 50_000,
    utilized: 1_000,
    apr: 8,
    riskScore: 700,
    openedAt: '2024-01-01',
    updatedAt: '2026-01-01T00:00:00.000Z',
    transactions: [],
    statusHistory: [],
    ...rest,
  };
}

const activeLine = creditLine({ id: 'cl-active', name: 'Active Line', utilized: 1_000 });
const closedLine = creditLine({ id: 'cl-closed', name: 'Closed Line', status: 'Closed' });
const emptyLine = creditLine({ id: 'cl-empty', name: 'Empty Line', utilized: 0 });

const usdcBalance = (balance: string) => ({
  asset: SETTLEMENT_ASSET.code,
  issuer: SETTLEMENT_ASSET.issuer,
  balance,
});

function renderPage() {
  return render(<AutopayPage />);
}

function chooseLine(lineId = 'cl-active') {
  fireEvent.change(screen.getByLabelText(/credit line/i), {
    target: { value: lineId },
  });
}

function setAmount(value: string) {
  fireEvent.change(screen.getByLabelText(/payment amount/i), {
    target: { value },
  });
}

function setStartDate(value: string) {
  fireEvent.change(screen.getByLabelText(/start date/i), {
    target: { value },
  });
}

describe('AutopayPage — credit line selection and balance warnings', () => {
  beforeEach(() => {
    state.lines = [activeLine, closedLine, emptyLine];
    state.balances = [usdcBalance('5000.0000000')];
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lists only repayable credit lines in the selector', () => {
    renderPage();

    const select = screen.getByLabelText(/credit line/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => option.textContent ?? '');

    expect(options.join(' ')).toContain('Active Line');
    expect(options.join(' ')).not.toContain('Closed Line');
    expect(options.join(' ')).not.toContain('Empty Line');
  });

  it('blocks submission until a credit line is chosen and focuses the selector', () => {
    renderPage();

    setAmount('100');
    setStartDate('2026-12-01');
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    expect(screen.getByText('Select a credit line to pay.')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/credit line/i));
    expect(screen.queryByText(/Autopay activated/i)).not.toBeInTheDocument();
  });

  it('warns when the amount exceeds the selected line repayable balance and clears it when reduced', () => {
    renderPage();
    chooseLine();

    setAmount('2000');
    expect(
      screen.getByText(/exceeds the line's repayable balance of \$1,007/i),
    ).toBeInTheDocument();

    const amountInput = screen.getByLabelText(/payment amount/i);
    expect(amountInput.getAttribute('aria-describedby')).toContain(
      'autopay-amount-line-warning',
    );

    setAmount('500');
    expect(
      screen.queryByText(/exceeds the line's repayable balance/i),
    ).not.toBeInTheDocument();
    expect(amountInput.getAttribute('aria-describedby') ?? '').not.toContain(
      'autopay-amount-line-warning',
    );
  });

  it('warns when the amount exceeds the wallet USDC balance', () => {
    state.lines = [creditLine({ id: 'cl-big', name: 'Big Line', utilized: 10_000 })];
    state.balances = [usdcBalance('100.0000000')];

    renderPage();
    chooseLine('cl-big');
    setAmount('200');

    expect(
      screen.getByText(/exceeds your USDC wallet balance of \$100/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeds the line's repayable balance/i),
    ).not.toBeInTheDocument();
  });

  it('does not block submission when only a warning is shown', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00'));

    renderPage();
    chooseLine();
    setAmount('2000');
    setStartDate('2026-12-01');

    expect(screen.getByText(/exceeds the line's repayable balance/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));
    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText(/Autopay activated/i)).toBeInTheDocument();
  });

  it('keeps the existing amount and start-date validation messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00'));

    renderPage();
    chooseLine();
    setStartDate('2020-01-01');
    fireEvent.click(screen.getByRole('button', { name: /activate autopay/i }));

    expect(
      screen.getByText('Enter a payment amount greater than $0.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Start date cannot be in the past.'),
    ).toBeInTheDocument();
  });

  it('passes the selected line name and repayable balance to the schedule preview', () => {
    renderPage();
    chooseLine();
    setAmount('500');
    setStartDate('2026-12-01');

    const previewLine = document.querySelector('.autopay-schedule__credit-line');
    expect(previewLine).not.toBeNull();
    expect(previewLine).toHaveTextContent('Active Line');
    expect(previewLine).toHaveTextContent(/1,007 repayable/);
  });
});
