import { beforeEach, describe, expect, it } from 'vitest';
import {
  createLimitIncreaseRequest,
  getLatestLimitIncreaseRequest,
  isValidLimitIncreaseRequest,
  listLimitIncreaseRequests,
  updateLimitIncreaseRequestStatus,
} from './limitIncreaseRequests';
import { limitIncreaseRequestsStorageKey } from '../constants/storageKeys';

const INPUT = {
  creditLineId: 'line-1',
  amount: 1000,
  reason: 'Working capital',
};

beforeEach(() => {
  localStorage.clear();
});

describe('limit increase request persistence', () => {
  it('stores requests per wallet and line and supports all workflow statuses', () => {
    const request = createLimitIncreaseRequest('wallet-a', INPUT);

    expect(request.status).toBe('pending');
    expect(listLimitIncreaseRequests('wallet-a')).toEqual([request]);
    expect(listLimitIncreaseRequests('wallet-b')).toEqual([]);

    const updated = updateLimitIncreaseRequestStatus('wallet-a', request.id, 'approved');
    expect(updated.status).toBe('approved');
    expect(listLimitIncreaseRequests('wallet-a')).toEqual([updated]);
  });

  it('validates stored requests and removes malformed entries on load', () => {
    const key = limitIncreaseRequestsStorageKey('wallet-a');
    localStorage.setItem(
      key,
      JSON.stringify([
        {
          id: 'valid',
          ...INPUT,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        { id: 'invalid', amount: -1 },
      ]),
    );

    const requests = listLimitIncreaseRequests('wallet-a');
    expect(requests).toHaveLength(1);
    expect(isValidLimitIncreaseRequest(requests[0])).toBe(true);
    expect(JSON.parse(localStorage.getItem(key) ?? '[]')).toEqual(requests);
  });

  it('returns the latest request for the requested line', () => {
    const older = createLimitIncreaseRequest('wallet-a', INPUT);
    const newer = createLimitIncreaseRequest('wallet-a', { ...INPUT, creditLineId: 'line-2' });

    expect(getLatestLimitIncreaseRequest([older, newer], 'line-1')).toEqual(older);
    expect(getLatestLimitIncreaseRequest([older, newer], 'missing')).toBeUndefined();
  });

  it('prevents duplicate pending requests for one credit line', () => {
    createLimitIncreaseRequest('wallet-a', INPUT);
    expect(() => createLimitIncreaseRequest('wallet-a', INPUT)).toThrow(/already exists/i);
  });

  it('rejects missing wallet identities and invalid request statuses', () => {
    expect(() => createLimitIncreaseRequest('', INPUT)).toThrow(/connected wallet/i);
    const request = createLimitIncreaseRequest('wallet-a', INPUT);
    expect(() =>
      updateLimitIncreaseRequestStatus(
        'wallet-a',
        request.id,
        'invalid' as 'pending',
      ),
    ).toThrow(/invalid.*status/i);
  });
});
