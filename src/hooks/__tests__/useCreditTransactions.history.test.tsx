import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CreditDataProvider } from '../../context/CreditDataContext';
import { WalletProvider } from '../../context/WalletContext';
import { useCreditTransactions } from '../useCreditLines';
import { CreditDataError, type CreditDataSource } from '../../services/credit/CreditDataSource';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditLine, Transaction } from '../../types/creditLine';
import type { WalletInfo } from '../../types/wallet';

const OWNER = 'GTESTCREDITDATAOWNER';
const wallet: WalletInfo = { type: 'freighter', publicKey: OWNER, network: 'TESTNET' };

function ledgerRow(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'Draw',
    amount: 100,
    date: '2025-02-20T12:00:00Z',
    status: 'Completed',
    txHash: `hash-${id}`,
    lineId: 'CL-1',
    ...overrides,
  };
}

function Probe({ cursor, limit = 2 }: { cursor?: string; limit?: number }) {
  const { status, transactions, nextCursor, error, serverPaged } = useCreditTransactions({
    cursor,
    limit,
  });
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="paged">{String(serverPaged)}</span>
      <span data-testid="ids">{transactions.map((entry) => entry.id).join(',')}</span>
      <span data-testid="names">{transactions.map((entry) => entry.lineName).join(',')}</span>
      <span data-testid="cursor">{nextCursor ?? ''}</span>
      <span data-testid="error">{error instanceof CreditDataError ? error.code : ''}</span>
    </div>
  );
}

function ledgerSource(listTransactions: CreditDataSource['listTransactions']): CreditDataSource {
  return {
    kind: 'soroban',
    listCreditLines: async () => MOCK_CREDIT_LINES,
    getCreditLine: async (id) => {
      const line = MOCK_CREDIT_LINES.find((entry) => entry.id === id);
      if (!line) throw new CreditDataError('not_found', id);
      return line;
    },
    listTransactions,
  };
}

function tree(source: CreditDataSource, cursor?: string) {
  return (
    <WalletProvider initialWallet={wallet}>
      <CreditDataProvider source={source}>
        <Probe cursor={cursor} />
      </CreditDataProvider>
    </WalletProvider>
  );
}

describe('useCreditTransactions with a ledger-backed source', () => {
  it('pages from the source and hands the cursor back untouched', async () => {
    const listTransactions = vi
      .fn()
      .mockResolvedValueOnce({ transactions: [ledgerRow('op-1'), ledgerRow('op-2')], nextCursor: 'token-2' })
      .mockResolvedValueOnce({ transactions: [ledgerRow('op-3')], nextCursor: null });
    const source = ledgerSource(listTransactions);

    const { rerender } = render(tree(source));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));

    expect(screen.getByTestId('paged').textContent).toBe('true');
    expect(screen.getByTestId('ids').textContent).toBe('op-1,op-2');
    expect(screen.getByTestId('cursor').textContent).toBe('token-2');
    expect(listTransactions).toHaveBeenCalledTimes(1);
    expect(listTransactions).toHaveBeenCalledWith(OWNER, {
      cursor: null,
      limit: 2,
      lineId: undefined,
      signal: expect.any(AbortSignal),
    });

    rerender(tree(source, 'token-2'));
    await waitFor(() => expect(screen.getByTestId('ids').textContent).toBe('op-3'));
    expect(listTransactions).toHaveBeenLastCalledWith(
      OWNER,
      expect.objectContaining({ cursor: 'token-2' }),
    );
  });

  it('joins the credit line name from the loaded lines', async () => {
    const name = MOCK_CREDIT_LINES[0].name;
    const listTransactions = vi.fn().mockResolvedValue({
      transactions: [ledgerRow('op-1', { lineId: MOCK_CREDIT_LINES[0].id })],
      nextCursor: null,
    });

    render(tree(ledgerSource(listTransactions)));
    await waitFor(() => expect(screen.getByTestId('names').textContent).toBe(name));
  });

  it('re-requests without a cursor when the caller resets pagination', async () => {
    const listTransactions = vi.fn().mockResolvedValue({
      transactions: [ledgerRow('op-1'), ledgerRow('op-2')],
      nextCursor: 'token-2',
    });
    const source = ledgerSource(listTransactions);

    const { rerender } = render(tree(source, 'token-9'));
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(1));
    expect(listTransactions).toHaveBeenCalledWith(
      OWNER,
      expect.objectContaining({ cursor: 'token-9' }),
    );

    // A filter change drops the cursor, so the next request starts over.
    rerender(tree(source, undefined));
    await waitFor(() => expect(listTransactions).toHaveBeenCalledTimes(2));
    expect(listTransactions).toHaveBeenLastCalledWith(
      OWNER,
      expect.objectContaining({ cursor: null }),
    );
  });

  it('does not re-request when only the credit line list refreshes', async () => {
    const listTransactions = vi.fn().mockResolvedValue({ transactions: [], nextCursor: null });
    const source: CreditDataSource = {
      ...ledgerSource(listTransactions),
      listCreditLines: vi
        .fn()
        .mockResolvedValueOnce([] as CreditLine[])
        .mockResolvedValueOnce(MOCK_CREDIT_LINES),
    };

    const { rerender } = render(tree(source));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('success'));
    const calls = listTransactions.mock.calls.length;

    rerender(tree(source));
    await act(async () => {
      await Promise.resolve();
    });
    expect(listTransactions).toHaveBeenCalledTimes(calls);
  });

  it('surfaces a history failure without clearing the line list', async () => {
    const listTransactions = vi
      .fn()
      .mockRejectedValue(new CreditDataError('network', 'Horizon unreachable'));

    render(tree(ledgerSource(listTransactions)));
    await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('network'));
    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('ids').textContent).toBe('');
  });

  it('keeps the fixture path local when the source is not ledger-backed', async () => {
    const listTransactions = vi.fn();
    const source: CreditDataSource = {
      kind: 'mock',
      listCreditLines: async () => MOCK_CREDIT_LINES,
      getCreditLine: async (id) => {
        const line = MOCK_CREDIT_LINES.find((entry) => entry.id === id);
        if (!line) throw new CreditDataError('not_found', id);
        return line;
      },
      listTransactions,
    };

    render(tree(source));
    await waitFor(() => expect(screen.getByTestId('paged').textContent).toBe('false'));
    expect(listTransactions).not.toHaveBeenCalled();
    const ids = screen.getByTestId('ids').textContent ?? '';
    expect(ids.split(',').length).toBe(2);
  });
});
