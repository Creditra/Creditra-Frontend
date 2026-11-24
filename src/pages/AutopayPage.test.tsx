import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AutopayPage, { parseAutopayAmount, validate, type AutopayFormState } from './AutopayPage';
import type { CreditLine } from '../types/creditLine';

const { mockState } = vi.hoisted(() => ({
  mockState: {
    lines: [] as CreditLine[],
    balances: null as Array<{ asset: string; balance: string; issuer?: string }> | null,
    walletKey: 'freighter:GAAA:TESTNET' as string | null,
  },
}));

vi.mock('../hooks/useCreditLines', () => ({
  useCreditLines: () => ({
    status: 'success',
    lines: mockState.lines,
    error: null,
    refetch: vi.fn(),
    lastUpdatedAt: null,
    owner: 'GAAA',
    wallet: null,
    setLines: vi.fn(),
  }),
}));

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    wallet: { publicKey: 'GAAA', network: 'TESTNET' },
    status: 'connected',
    balances: mockState.balances,
  }),
}));

vi.mock('../hooks/useWalletIdentityKey', () => ({
  useWalletIdentityKey: () => mockState.walletKey,
}));

const MOCK_LINE: CreditLine = {
  id: 'cl-1',
  name: 'Prime Working Capital',
  status: 'Active',
  limit: 5000,
  utilized: 1200,
  apr: 8,
  riskScore: 750,
  openedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  transactions: [],
  statusHistory: [],
};

describe('parseAutopayAmount', () => {
  const validCases: Array<[string, number]> = [
    ['12', 12],
    ['12.5', 12.5],
    ['0.01', 0.01],
    ['100', 100],
    ['1000000', 1000000],
    [' 12.50 ', 12.5],
    ['0.99', 0.99],
    ['5.00', 5],
  ];

  it.each(validCases)('accepts valid amount string %s -> %s', (input, expected) => {
    expect(parseAutopayAmount(input)).toBe(expected);
  });

  const invalidCases: string[] = [
    '12abc',
    '1e3',
    '.',
    '1.2.3',
    '-5',
    '--5',
    '1,000',
    '',
    '   ',
    '0',
    '0.0',
    '0.00',
    '12.345',
    'abc',
    '$$12',
    '+12',
    '.5',
    '1.',
  ];

  it.each(invalidCases)('rejects invalid amount string %s', (input) => {
    expect(parseAutopayAmount(input)).toBeNull();
  });
});

describe('validate amount rules', () => {
  const baseForm: AutopayFormState = {
    creditLineId: 'cl-1',
    amount: '',
    frequency: 'monthly',
    startDate: '2027-01-15',
    endDate: '',
  };

  const lineIds = new Set(['cl-1']);

  const invalidAmounts = [
    '12abc',
    '1e3',
    '--5',
    '-5',
    '1,000',
    '',
    '   ',
    '.',
    '1.2.3',
    '0',
    '0.00',
    '12.345',
  ];

  it.each(invalidAmounts)(
    'returns "Enter a payment amount greater than $0." for %s',
    (amount) => {
      const errors = validate({ ...baseForm, amount }, lineIds, [], null);
      expect(errors.amount).toBe('Enter a payment amount greater than $0.');
    },
  );

  it('rejects amounts exceeding $1,000,000 with specific cap error', () => {
    const errorsOverCap = validate(
      { ...baseForm, amount: '1000000.01' },
      lineIds,
      [],
      null,
    );
    expect(errorsOverCap.amount).toBe('Amount cannot exceed $1,000,000 per payment.');

    const errorsOverCap2 = validate(
      { ...baseForm, amount: '2000000' },
      lineIds,
      [],
      null,
    );
    expect(errorsOverCap2.amount).toBe('Amount cannot exceed $1,000,000 per payment.');
  });

  const validAmounts = ['12', '12.5', '0.01', '1000000'];

  it.each(validAmounts)('accepts valid amount %s without amount error', (amount) => {
    const errors = validate({ ...baseForm, amount }, lineIds, [], null);
    expect(errors.amount).toBeUndefined();
  });
});

describe('AutopayPage form amount validation & preview', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.lines = [MOCK_LINE];
    mockState.balances = null;
    mockState.walletKey = 'freighter:GAAA:TESTNET';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const invalidInputs = ['12abc', '1e3', '.', '1.2.3', '-5'];

  it.each(invalidInputs)(
    'rejects invalid amount %s with inline error on form submit',
    (amount) => {
      render(<AutopayPage />);

      fireEvent.change(screen.getByLabelText(/Credit Line/i), {
        target: { value: 'cl-1' },
      });
      fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
        target: { value: amount },
      });
      fireEvent.change(screen.getByLabelText(/Start Date/i), {
        target: { value: '2027-01-15' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

      expect(
        screen.getByText('Enter a payment amount greater than $0.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Autopay activated\./i)).not.toBeInTheDocument();
    },
  );

  const validInputs = ['12', '12.5', '0.01'];

  it.each(validInputs)(
    'accepts valid amount %s and activates schedule on submit',
    (amount) => {
      render(<AutopayPage />);

      fireEvent.change(screen.getByLabelText(/Credit Line/i), {
        target: { value: 'cl-1' },
      });
      fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
        target: { value: amount },
      });
      fireEvent.change(screen.getByLabelText(/Start Date/i), {
        target: { value: '2027-01-15' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

      expect(screen.getByText(/Autopay activated\./i)).toBeInTheDocument();
      expect(
        screen.queryByText('Enter a payment amount greater than $0.'),
      ).not.toBeInTheDocument();
    },
  );

  it('shows preview only for fully valid amounts, not invalid inputs', () => {
    render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/Credit Line/i), {
      target: { value: 'cl-1' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2027-01-15' },
    });

    // Placeholder is shown when amount is empty
    expect(
      screen.getByText(/Fill in an amount and start date to see your upcoming payment schedule/i),
    ).toBeInTheDocument();

    // Invalid amount: 12abc -> preview placeholder still shown
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '12abc' },
    });
    expect(
      screen.getByText(/Fill in an amount and start date to see your upcoming payment schedule/i),
    ).toBeInTheDocument();

    // Invalid amount: 1e3 -> preview placeholder still shown
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '1e3' },
    });
    expect(
      screen.getByText(/Fill in an amount and start date to see your upcoming payment schedule/i),
    ).toBeInTheDocument();

    // Valid amount: 12 -> preview placeholder replaced by schedule preview
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '12' },
    });
    expect(
      screen.queryByText(/Fill in an amount and start date to see your upcoming payment schedule/i),
    ).not.toBeInTheDocument();
  });
});

describe('AutopayPage timer & cancel announcements', () => {
  beforeEach(() => {
    mockState.lines = [];
    mockState.balances = null;
    mockState.walletKey = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces cancel and clears the announcement after 4000ms', () => {
    vi.useFakeTimers();
    render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);

    expect(screen.getByText('Autopay schedule cleared.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Autopay schedule cleared.')).not.toBeInTheDocument();
  });

  it('clears the cancel-announcement timer on unmount without warnings', () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('clears the previous timer when cancel is clicked repeatedly', () => {
    vi.useFakeTimers();
    render(<AutopayPage />);

    const cancelButton = screen.getByRole('button', { name: /cancel autopay/i });
    fireEvent.click(cancelButton);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    fireEvent.click(cancelButton);
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Still visible because the timer was reset on the second click
    expect(screen.getByText('Autopay schedule cleared.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.queryByText('Autopay schedule cleared.')).not.toBeInTheDocument();
  });
});

describe('AutopayPage schedule persistence & management', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.lines = [MOCK_LINE];
    mockState.balances = null;
    mockState.walletKey = 'freighter:GAAA:TESTNET';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a schedule, persists it across remount, edits in place, and cancels via ConfirmDialog', async () => {
    const { unmount } = render(<AutopayPage />);

    // Create a schedule
    fireEvent.change(screen.getByLabelText(/Credit Line/i), {
      target: { value: 'cl-1' },
    });
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '250' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2027-01-15' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

    expect(screen.getByText(/Autopay activated\./i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Edit autopay schedule for Prime Working Capital/i }),
    ).toBeInTheDocument();

    // Simulate page reload by unmounting and remounting
    unmount();
    render(<AutopayPage />);

    expect(screen.getByText(/\$250 · Monthly · Starts 2027-01-15/i)).toBeInTheDocument();
    expect(screen.getByText(/Next scheduled payment:/i)).toBeInTheDocument();

    // Edit in place
    fireEvent.click(
      screen.getByRole('button', { name: /Edit autopay schedule for Prime Working Capital/i }),
    );
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '375' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(screen.getByText(/Autopay updated\./i)).toBeInTheDocument();
    expect(screen.getByText(/\$375 · Monthly · Starts 2027-01-15/i)).toBeInTheDocument();

    // Cancel via ConfirmDialog
    fireEvent.click(
      screen.getByRole('button', { name: /Cancel autopay schedule for Prime Working Capital/i }),
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel Schedule$/i }));

    expect(
      await screen.findByText(/No active autopay schedules saved for this wallet yet/i),
    ).toBeInTheDocument();
  });

  it('scopes persisted schedules per wallet', async () => {
    const { unmount } = render(<AutopayPage />);

    fireEvent.change(screen.getByLabelText(/Credit Line/i), {
      target: { value: 'cl-1' },
    });
    fireEvent.change(screen.getByLabelText(/Payment Amount/i), {
      target: { value: '150' },
    });
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2027-02-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Activate Autopay/i }));

    expect(screen.getByText(/\$150 · Monthly · Starts 2027-02-01/i)).toBeInTheDocument();

    // Switch to another wallet
    mockState.walletKey = 'freighter:GBBB:TESTNET';
    unmount();
    render(<AutopayPage />);

    expect(
      await screen.findByText(/No active autopay schedules saved for this wallet yet/i),
    ).toBeInTheDocument();
  });
});
