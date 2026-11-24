import { describe, it, expect, beforeEach } from 'vitest';
import {
  CreditDataError,
  MockCreditAdapter,
  MockCreditDataSource,
  type CreditDataSource,
} from '../index';
import { getGlobalCreditLines } from '@/hooks/useCreditLines';
import { resetGlobalCreditLines } from '@/test/creditLinesTestHelpers';
import { MOCK_CREDIT_LINES } from '@/data/mockData';

describe('CreditDataPort - MockCreditAdapter', () => {
  beforeEach(() => {
    resetGlobalCreditLines();
  });

  it('accepts offer, creates an Active line and appends to credit lines list', async () => {
    const initialLines = getGlobalCreditLines();
    const adapter = new MockCreditAdapter();
    const newLine = await adapter.acceptOffer('GBZX...WALLET', 'OFFER-123');

    expect(newLine.status).toBe('Active');
    expect(newLine.id).toBeDefined();

    const updatedLines = await adapter.listCreditLines('GBZX...WALLET');
    expect(updatedLines.length).toBe(initialLines.length + 1);
    expect(updatedLines[0].id).toBe(newLine.id);
  });
});

describe('MockCreditDataSource - listTransactions', () => {
  const source: CreditDataSource = new MockCreditDataSource(MOCK_CREDIT_LINES);
  const lineWithTxs = MOCK_CREDIT_LINES.find((l) => l.transactions.length >= 2)!;

  it('paginates transactions with limit and cursor', async () => {
    const page1 = await source.listTransactions(lineWithTxs.id, { limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe(lineWithTxs.transactions[0].id);
    expect(page1.nextCursor).toBe('1');

    const page2 = await source.listTransactions(lineWithTxs.id, {
      cursor: page1.nextCursor,
      limit: 1,
    });
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).toBe(lineWithTxs.transactions[1].id);
  });

  it('throws aborted when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      source.listTransactions(lineWithTxs.id, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' });
  });

  it('throws not_found for unknown lineId and invalid_response for bad cursor', async () => {
    await expect(source.listTransactions('does-not-exist')).rejects.toBeInstanceOf(
      CreditDataError,
    );
    await expect(source.listTransactions('does-not-exist')).rejects.toMatchObject({
      code: 'not_found',
    });

    await expect(
      source.listTransactions(lineWithTxs.id, { cursor: 'not-a-number' }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
