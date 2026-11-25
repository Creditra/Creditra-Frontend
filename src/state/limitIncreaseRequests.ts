import { useCallback, useEffect, useState } from 'react';
import { limitIncreaseRequestsStorageKey } from '../constants/storageKeys';
import { readJson, removeKey, writeJson } from '../utils/storage';

export type LimitIncreaseRequestStatus = 'pending' | 'approved' | 'declined';

export interface LimitIncreaseRequest {
  id: string;
  creditLineId: string;
  amount: number;
  reason: string;
  status: LimitIncreaseRequestStatus;
  createdAt: string;
}

export interface CreateLimitIncreaseRequestInput {
  creditLineId: string;
  amount: number;
  reason: string;
}

const VALID_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'approved',
  'declined',
]);
const LIMIT_INCREASE_SYNC_EVENT = 'creditra:limit-increase-requests-updated';

export function isValidLimitIncreaseRequest(value: unknown): value is LimitIncreaseRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.id === 'string' &&
    request.id.trim().length > 0 &&
    typeof request.creditLineId === 'string' &&
    request.creditLineId.trim().length > 0 &&
    typeof request.amount === 'number' &&
    Number.isFinite(request.amount) &&
    request.amount > 0 &&
    typeof request.reason === 'string' &&
    request.reason.trim().length > 0 &&
    typeof request.status === 'string' &&
    VALID_STATUSES.has(request.status) &&
    typeof request.createdAt === 'string' &&
    !Number.isNaN(Date.parse(request.createdAt))
  );
}

function assertWalletKey(walletKey: string | null | undefined): asserts walletKey is string {
  if (!walletKey || walletKey.trim().length === 0) {
    throw new Error('A connected wallet is required to request a limit increase.');
  }
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `lir-${crypto.randomUUID()}`;
  }
  return `lir-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitSyncEvent(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(LIMIT_INCREASE_SYNC_EVENT, { detail: { key } }));
  } catch {
    // The localStorage write is authoritative; same-tab refresh is best-effort.
  }
}

/** Load validated requests for one wallet; discard invalid or malformed storage. */
export function listLimitIncreaseRequests(
  walletKey: string | null | undefined,
): LimitIncreaseRequest[] {
  if (!walletKey || walletKey.trim().length === 0) return [];

  const key = limitIncreaseRequestsStorageKey(walletKey);
  const raw = readJson<unknown>(key, null);
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    removeKey(key);
    return [];
  }

  const valid = raw.filter(isValidLimitIncreaseRequest);
  if (valid.length !== raw.length) {
    if (valid.length === 0) removeKey(key);
    else writeJson(key, valid);
  }
  return valid;
}

export function createLimitIncreaseRequest(
  walletKey: string,
  input: CreateLimitIncreaseRequestInput,
): LimitIncreaseRequest {
  assertWalletKey(walletKey);
  const request: LimitIncreaseRequest = {
    id: createRequestId(),
    creditLineId: input.creditLineId,
    amount: input.amount,
    reason: input.reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  if (!isValidLimitIncreaseRequest(request)) {
    throw new Error('Invalid limit increase request parameters.');
  }

  const key = limitIncreaseRequestsStorageKey(walletKey);
  const existing = listLimitIncreaseRequests(walletKey);
  if (
    existing.some(
      (saved) =>
        saved.creditLineId === request.creditLineId && saved.status === 'pending',
    )
  ) {
    throw new Error('A pending limit increase request already exists for this credit line.');
  }
  const next = [...existing, request];
  if (!writeJson(key, next)) {
    throw new Error('Unable to save the limit increase request. Check browser storage and try again.');
  }
  emitSyncEvent(key);
  return request;
}

export function updateLimitIncreaseRequestStatus(
  walletKey: string,
  requestId: string,
  status: LimitIncreaseRequestStatus,
): LimitIncreaseRequest {
  assertWalletKey(walletKey);
  if (!VALID_STATUSES.has(status)) {
    throw new Error('Invalid limit increase request status.');
  }

  const requests = listLimitIncreaseRequests(walletKey);
  const index = requests.findIndex((request) => request.id === requestId);
  if (index < 0) throw new Error(`Limit increase request not found: ${requestId}`);

  const updated = { ...requests[index], status };
  const next = [...requests];
  next[index] = updated;
  const key = limitIncreaseRequestsStorageKey(walletKey);
  if (!writeJson(key, next)) {
    throw new Error('Unable to save the limit increase request status.');
  }
  emitSyncEvent(key);
  return updated;
}

export function getLatestLimitIncreaseRequest(
  requests: readonly LimitIncreaseRequest[],
  creditLineId: string,
): LimitIncreaseRequest | undefined {
  return requests
    .filter((request) => request.creditLineId === creditLineId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export function useLimitIncreaseRequestsForWallet(walletKey: string | null) {
  const [requests, setRequests] = useState<LimitIncreaseRequest[]>(() =>
    listLimitIncreaseRequests(walletKey),
  );

  useEffect(() => {
    setRequests(listLimitIncreaseRequests(walletKey));
  }, [walletKey]);

  useEffect(() => {
    if (!walletKey || typeof window === 'undefined') return;
    const expectedKey = limitIncreaseRequestsStorageKey(walletKey);
    const refresh = () => setRequests(listLimitIncreaseRequests(walletKey));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === expectedKey) refresh();
    };
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || detail.key === expectedKey) refresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(LIMIT_INCREASE_SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LIMIT_INCREASE_SYNC_EVENT, onSync);
    };
  }, [walletKey]);

  const create = useCallback(
    (input: CreateLimitIncreaseRequestInput) => {
      assertWalletKey(walletKey);
      const created = createLimitIncreaseRequest(walletKey, input);
      setRequests(listLimitIncreaseRequests(walletKey));
      return created;
    },
    [walletKey],
  );

  return { requests, create };
}
