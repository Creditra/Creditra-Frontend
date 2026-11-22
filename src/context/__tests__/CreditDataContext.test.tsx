import { act, render, screen, waitFor } from '@testing-library/react';
import { CreditDataProvider } from '../CreditDataContext';
import { WalletProvider } from '../WalletContext';
import { useCreditLine, useCreditLines, useCreditTransactions } from '../../hooks/useCreditLines';
import type { CreditDataSource } from '../../services/credit/CreditDataSource';
import { CreditDataError } from '../../services/credit/CreditDataSource';
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
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn() };
    render(tree(null, source));

    expect(screen.getByTestId('list-status')).toHaveTextContent('idle');
    expect(listCreditLines).not.toHaveBeenCalled();
  });

  it('keeps the provider loading without scheduling a fake timer', async () => {
    const listCreditLines = vi.fn(() => new Promise<CreditLine[]>(() => undefined));
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn() };
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
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn() };
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
    };
    render(tree(walletA, source));

    await waitFor(() => expect(screen.getByTestId('line-status')).toHaveTextContent('error'));
    expect(screen.getByTestId('line-error')).toHaveTextContent('not_found');
  });

  it('paginates the shared transactions by cursor without another source request', async () => {
    const listCreditLines = vi.fn().mockResolvedValue(MOCK_CREDIT_LINES);
    const source: CreditDataSource = { listCreditLines, getCreditLine: vi.fn() };
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
});
