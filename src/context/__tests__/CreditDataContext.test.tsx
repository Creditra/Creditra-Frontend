import { act, render, screen, waitFor } from '@testing-library/react';
import { Address, nativeToScVal, rpc, xdr } from '@stellar/stellar-sdk';
import { CreditDataProvider } from '../CreditDataContext';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { WalletProvider } from '../WalletContext';
import { useCreditLine, useCreditLines, useCreditTransactions } from '../../hooks/useCreditLines';
import type { CreditDataSource } from '../../services/credit/CreditDataSource';
import { CreditDataError } from '../../services/credit/CreditDataSource';
import { SorobanCreditDataSource } from '../../services/credit/sorobanCreditDataSource';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import type { CreditLine } from '../../types/creditLine';
import type { WalletInfo } from '../../types/wallet';

const walletA: WalletInfo = { type: 'freighter', publicKey: 'GACCOUNT-A', network: 'TESTNET' };
const walletB: WalletInfo = { type: 'freighter', publicKey: 'GACCOUNT-B', network: 'TESTNET' };

function Probe({ id = 'missing' }: { id?: string }) {
  const { status, lines } = useCreditLines();
  const line = useCreditLine(id);
  return (
    <div>
      <span data-testid="list-status">{status}</span>
      <span data-testid="list-lines">{lines.map((entry) => entry.id).join(',')}</span>
      <span data-testid="line-status">{line.status}</span>
      <span data-testid="line-error">{line.error instanceof CreditDataError ? line.error.code : ''}</span>
    </div>
  );
}

function TransactionProbe({ cursor, testId }: { cursor?: string; testId: string }) {
  const { status, transactions, nextCursor } = useCreditTransactions({ cursor, limit: 1 });
  return (
    <div>
      <span data-testid={`${testId}-status`}>{status}</span>
      <span data-testid={`${testId}-transaction`}>{transactions[0]?.id ?? ''}</span>
      <span data-testid={`${testId}-cursor`}>{nextCursor ?? ''}</span>
    </div>
  );
}

function UnsortedTransactionProbe() {
  const { transactions } = useCreditTransactions({ sort: false });
  return (
    <span data-testid="unsorted-transactions">
      {transactions.map((transaction) => transaction.id).join(',')}
    </span>
  );
}

function tree(wallet: WalletInfo | null, source: CreditDataSource, probe = <Probe />) {
  return (
    <WalletProvider initialWallet={wallet}>
      <CreditDataProvider source={source}>{probe}</CreditDataProvider>
    </WalletProvider>
  );
}

describe('CreditDataProvider', () => {
  it('deduplicates the line request shared by multiple hook consumers', async () => {
    const listCreditLines = vi.fn().mockResolvedValue(MOCK_CREDIT_LINES);
    const source: CreditDataSource = {
      listCreditLines,
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };
    render(tree(walletA, source, <>
      <Probe id={MOCK_CREDIT_LINES[0].id} />
      <Probe id={MOCK_CREDIT_LINES[1].id} />
      <Probe id={MOCK_CREDIT_LINES[2].id} />
      <Probe id={MOCK_CREDIT_LINES[3].id} />
      <Probe id={MOCK_CREDIT_LINES[4].id} />
    </>));

    await waitFor(() => expect(screen.getAllByTestId('list-status')[0]).toHaveTextContent('success'));
    expect(listCreditLines).toHaveBeenCalledTimes(1);
    expect(listCreditLines).toHaveBeenCalledWith(walletA.publicKey);
  });

  it('does not call the source while disconnected', async () => {
    const listCreditLines = vi.fn().mockResolvedValue(MOCK_CREDIT_LINES);
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn(), listTransactions: vi.fn().mockResolvedValue({ items: [] }) };
    render(tree(null, source));

    expect(screen.getByTestId('list-status')).toHaveTextContent('idle');
    expect(listCreditLines).not.toHaveBeenCalled();
  });

  it('keeps the provider loading without scheduling a fake timer', async () => {
    const listCreditLines = vi.fn(() => new Promise<CreditLine[]>(() => undefined));
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn(), listTransactions: vi.fn().mockResolvedValue({ items: [] }) };
    vi.useFakeTimers();
    try {
      render(tree(walletA, source));
      await act(async () => Promise.resolve());
      expect(screen.getByTestId('list-status')).toHaveTextContent('loading');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a response from the previous wallet identity', async () => {
    let resolveA!: (lines: CreditLine[]) => void;
    let resolveB!: (lines: CreditLine[]) => void;
    const ownerLines = (id: string) => [{ ...MOCK_CREDIT_LINES[0], id, name: id }];
    const listCreditLines = vi.fn((owner: string) => new Promise<CreditLine[]>((resolve) => {
      if (owner === walletA.publicKey) resolveA = resolve;
      else resolveB = resolve;
    }));
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn(), listTransactions: vi.fn().mockResolvedValue({ items: [] }) };
    const view = render(tree(walletA, source));

    await waitFor(() => expect(listCreditLines).toHaveBeenCalledTimes(1));
    view.rerender(tree(walletB, source));
    await waitFor(() => expect(listCreditLines).toHaveBeenCalledTimes(2));

    await act(async () => resolveA(ownerLines('account-a-line')));
    await act(async () => resolveB(ownerLines('account-b-line')));
    await waitFor(() => expect(screen.getByTestId('list-lines')).toHaveTextContent('account-b-line'));
    expect(screen.queryByText('account-a-line')).not.toBeInTheDocument();
  });

  it('returns not_found for an unknown credit-line id', async () => {
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue(MOCK_CREDIT_LINES),
      getCreditLine: vi.fn(),
      listTransactions: vi.fn().mockResolvedValue({ items: [] }),
    };
    render(tree(walletA, source));

    await waitFor(() => expect(screen.getByTestId('line-status')).toHaveTextContent('error'));
    expect(screen.getByTestId('line-error')).toHaveTextContent('not_found');
  });

  it('paginates the shared transactions by cursor without another source request', async () => {
    const listCreditLines = vi.fn().mockResolvedValue(MOCK_CREDIT_LINES);
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn(), listTransactions: vi.fn().mockResolvedValue({ items: [] }) };
    const expected = MOCK_CREDIT_LINES.flatMap((line) => line.transactions)
      .sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() || b.id.localeCompare(a.id),
      );
    render(tree(walletA, source, <>
      <TransactionProbe testId="first" />
      <TransactionProbe cursor={expected[0].id} testId="second" />
    </>));

    await waitFor(() => expect(screen.getByTestId('first-status')).toHaveTextContent('success'));
    expect(screen.getByTestId('first-transaction')).toHaveTextContent(expected[0].id);
    expect(screen.getByTestId('first-cursor')).toHaveTextContent(expected[0].id);
    expect(screen.getByTestId('second-transaction')).toHaveTextContent(expected[1].id);
    expect(listCreditLines).toHaveBeenCalledTimes(1);
  });

  it('preserves transaction order when sorting is delegated to a downstream worker', async () => {
    const transactions = [
      {
        ...MOCK_CREDIT_LINES[0].transactions[1],
        id: 'older',
        date: '2024-01-01T00:00:00Z',
      },
      {
        ...MOCK_CREDIT_LINES[0].transactions[0],
        id: 'newer',
        date: '2025-01-01T00:00:00Z',
      },
    ];
    const line = { ...MOCK_CREDIT_LINES[0], transactions };
    const source: CreditDataSource = {
      listCreditLines: vi.fn().mockResolvedValue([line]),
      getCreditLine: vi.fn(),
    };
    render(tree(walletA, source, <UnsortedTransactionProbe />));

    await waitFor(() => {
      expect(screen.getByTestId('unsorted-transactions')).toHaveTextContent(
        'older,newer',
      );
    });
  });
});

describe('CreditDataProvider contract events', () => {
  const BORROWER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
  const borrowerWallet: WalletInfo = { type: 'freighter', publicKey: BORROWER, network: 'TESTNET' };
  const symbol = (value: string) => nativeToScVal(value, { type: 'symbol' });

  function drawnEvent(id: string): rpc.Api.EventResponse {
    return {
      id,
      type: 'contract',
      ledger: 100,
      ledgerClosedAt: '2026-11-23T00:00:00Z',
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      txHash: `tx-${id}`,
      topic: [symbol('credit'), symbol('drawn')],
      value: xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: symbol('amount'), val: nativeToScVal(250_000_000n, { type: 'i128' }) }),
        new xdr.ScMapEntry({ key: symbol('borrower'), val: new Address(BORROWER).toScVal() }),
      ]),
    };
  }

  function eventsPage(events: rpc.Api.EventResponse[], cursor: string): rpc.Api.GetEventsResponse {
    return { events, cursor, latestLedger: 100, oldestLedger: 1, latestLedgerCloseTime: '0', oldestLedgerCloseTime: '0' };
  }

  function ToastProbe() {
    const { toasts } = useNotifications();
    return <span data-testid="toast-titles">{toasts.map((toast) => toast.title).join(',')}</span>;
  }

  function sorobanSource(events: rpc.Api.EventResponse[]) {
    const server = {
      getLatestLedger: vi.fn().mockResolvedValue({ id: 'ledger', sequence: 100, protocolVersion: 22 }),
      getEvents: vi.fn()
        .mockResolvedValueOnce(eventsPage([], 'c1'))
        .mockResolvedValueOnce(eventsPage(events, 'c2'))
        .mockReturnValue(new Promise(() => undefined)),
    };
    const source = new SorobanCreditDataSource({
      server: server as unknown as rpc.Server,
      contractId: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    const listCreditLines = vi.spyOn(source, 'listCreditLines').mockResolvedValue(MOCK_CREDIT_LINES);
    return { source, server, listCreditLines };
  }

  it('refetches credit lines and notifies when a draw event arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { source, server, listCreditLines } = sorobanSource([drawnEvent('evt-1')]);
    const { unmount } = render(
      <WalletProvider initialWallet={borrowerWallet}>
        <NotificationProvider>
          <CreditDataProvider source={source}>
            <ToastProbe />
          </CreditDataProvider>
        </NotificationProvider>
      </WalletProvider>,
    );

    try {
      await waitFor(() => expect(listCreditLines).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(server.getEvents).toHaveBeenCalledTimes(1));
      expect(screen.getByTestId('toast-titles')).toBeEmptyDOMElement();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });

      await waitFor(() => expect(screen.getByTestId('toast-titles')).toHaveTextContent('Credit drawn'));
      expect(listCreditLines).toHaveBeenCalledTimes(2);
      expect(server.getEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({ startLedger: 100 }));
      expect(server.getEvents).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'c1' }));
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { source, server } = sorobanSource([]);
    server.getEvents.mockReset().mockResolvedValue(eventsPage([], 'c1'));
    try {
      const { unmount } = render(
        <WalletProvider initialWallet={borrowerWallet}>
          <CreditDataProvider source={source}>
            <Probe />
          </CreditDataProvider>
        </WalletProvider>,
      );
      await waitFor(() => expect(server.getEvents).toHaveBeenCalledTimes(1));

      unmount();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });

      expect(server.getEvents).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
