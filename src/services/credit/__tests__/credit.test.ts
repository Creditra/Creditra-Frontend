import { describe, it, expect, beforeEach } from 'vitest';
import { creditService, MockCreditAdapter } from '../index';
import { getGlobalCreditLines, resetGlobalCreditLines } from '@/hooks/useCreditLines';

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
