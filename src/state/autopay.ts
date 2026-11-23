import { useCallback, useEffect, useMemo, useState } from 'react';
import { autopaySchedulesStorageKey } from '@/constants/storageKeys';
import { useWalletIdentityKey } from '@/hooks/useWalletIdentityKey';
import { buildSchedule, toLocalDateString, type AutopayFrequency } from '@/lib/autopay-schedule';
import { readJson, removeKey, writeJson } from '@/utils/storage';

// ── Types ───────────────────────────────────────────────────────────────────

export type AutopayScheduleStatus = 'active' | 'paused' | 'cancelled';

export interface AutopayScheduleRecord {
  id: string;
  creditLineId: string;
  amount: number;
  frequency: AutopayFrequency;
  startDate: string;
  endDate?: string;
  status: AutopayScheduleStatus;
  createdAt: string;
}

export interface CreateAutopayScheduleInput {
  creditLineId: string;
  amount: number;
  frequency: AutopayFrequency;
  startDate: string;
  endDate?: string;
}

export interface UpdateAutopayScheduleInput {
  creditLineId?: string;
  amount?: number;
  frequency?: AutopayFrequency;
  startDate?: string;
  endDate?: string;
  status?: AutopayScheduleStatus;
}

export interface NextScheduledPayment {
  schedule: AutopayScheduleRecord;
  date: string; // YYYY-MM-DD
  amount: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const VALID_FREQUENCIES: ReadonlySet<string> = new Set<AutopayFrequency>([
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
]);

const VALID_STATUSES: ReadonlySet<string> = new Set<AutopayScheduleStatus>([
  'active',
  'paused',
  'cancelled',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000;
const FAR_FUTURE_DATE = '9999-12-31';
const AUTOPAY_SYNC_EVENT = 'creditra:autopay-schedules-updated';

// ── Validation Helpers ──────────────────────────────────────────────────────

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return (
    parsed.getFullYear() === y &&
    parsed.getMonth() === m - 1 &&
    parsed.getDate() === d
  );
}

export function isValidAutopayScheduleRecord(value: unknown): value is AutopayScheduleRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.trim().length === 0) return false;
  if (typeof r.creditLineId !== 'string' || r.creditLineId.trim().length === 0) return false;
  if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount <= 0 || r.amount > MAX_AMOUNT) {
    return false;
  }
  if (typeof r.frequency !== 'string' || !VALID_FREQUENCIES.has(r.frequency)) return false;
  if (!isValidIsoDate(r.startDate)) return false;
  if (r.endDate !== undefined) {
    if (!isValidIsoDate(r.endDate) || r.endDate <= r.startDate) return false;
  }
  if (typeof r.status !== 'string' || !VALID_STATUSES.has(r.status)) return false;
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) return false;

  return true;
}

function assertValidWalletKey(walletKey: string | null | undefined): asserts walletKey is string {
  if (!walletKey || typeof walletKey !== 'string' || walletKey.trim().length === 0) {
    throw new Error('A connected wallet is required to manage autopay schedules.');
  }
}

function generateScheduleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ap-${crypto.randomUUID()}`;
  }
  return `ap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitSyncEvent(storageKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(AUTOPAY_SYNC_EVENT, { detail: { key: storageKey } }),
    );
  } catch {
    /* ignore */
  }
}

// ── Overlap Detection ───────────────────────────────────────────────────────

export function hasOverlappingActiveSchedule(
  schedules: readonly AutopayScheduleRecord[],
  candidate: { creditLineId: string; startDate: string; endDate?: string },
  excludeId?: string,
): boolean {
  const candidateEnd = candidate.endDate ?? FAR_FUTURE_DATE;
  return schedules.some((existing) => {
    if (existing.id === excludeId) return false;
    if (existing.status !== 'active') return false;
    if (existing.creditLineId !== candidate.creditLineId) return false;
    const existingEnd = existing.endDate ?? FAR_FUTURE_DATE;
    return candidate.startDate <= existingEnd && existing.startDate <= candidateEnd;
  });
}

// ── Persistence CRUD ────────────────────────────────────────────────────────

/**
 * Load all valid autopay schedules for the given wallet key.
 * Corrupt or tampered data is discarded safely.
 */
export function listAutopaySchedules(
  walletKey: string | null | undefined,
): AutopayScheduleRecord[] {
  if (!walletKey || typeof walletKey !== 'string' || walletKey.trim().length === 0) {
    return [];
  }
  const key = autopaySchedulesStorageKey(walletKey);
  const raw = readJson<unknown>(key, null);
  if (raw === null) return [];

  if (!Array.isArray(raw)) {
    removeKey(key);
    return [];
  }

  const valid = raw.filter(isValidAutopayScheduleRecord);
  if (valid.length !== raw.length) {
    if (valid.length === 0) {
      removeKey(key);
    } else {
      writeJson(key, valid);
    }
  }
  return valid;
}

function persistSchedules(walletKey: string, schedules: AutopayScheduleRecord[]): void {
  const key = autopaySchedulesStorageKey(walletKey);
  writeJson(key, schedules);
  emitSyncEvent(key);
}

export function createAutopaySchedule(
  walletKey: string,
  input: CreateAutopayScheduleInput,
): AutopayScheduleRecord {
  assertValidWalletKey(walletKey);

  const record: AutopayScheduleRecord = {
    id: generateScheduleId(),
    creditLineId: input.creditLineId,
    amount: input.amount,
    frequency: input.frequency,
    startDate: input.startDate,
    ...(input.endDate ? { endDate: input.endDate } : {}),
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  if (!isValidAutopayScheduleRecord(record)) {
    throw new Error('Invalid autopay schedule parameters.');
  }

  const existing = listAutopaySchedules(walletKey);
  if (hasOverlappingActiveSchedule(existing, record)) {
    throw new Error(
      'An active autopay schedule already overlaps this date range for the selected credit line.',
    );
  }

  const next = [...existing, record];
  persistSchedules(walletKey, next);
  return record;
}

export function updateAutopaySchedule(
  walletKey: string,
  id: string,
  patch: UpdateAutopayScheduleInput,
): AutopayScheduleRecord {
  assertValidWalletKey(walletKey);

  const existing = listAutopaySchedules(walletKey);
  const index = existing.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error(`Autopay schedule not found: ${id}`);
  }

  const current = existing[index];
  const updated: AutopayScheduleRecord = {
    ...current,
    ...(patch.creditLineId !== undefined ? { creditLineId: patch.creditLineId } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.frequency !== undefined ? { frequency: patch.frequency } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };

  if ('endDate' in patch) {
    if (patch.endDate) {
      updated.endDate = patch.endDate;
    } else {
      delete updated.endDate;
    }
  }

  if (!isValidAutopayScheduleRecord(updated)) {
    throw new Error('Invalid autopay schedule parameters.');
  }

  if (
    updated.status === 'active' &&
    hasOverlappingActiveSchedule(existing, updated, id)
  ) {
    throw new Error(
      'An active autopay schedule already overlaps this date range for the selected credit line.',
    );
  }

  const next = [...existing];
  next[index] = updated;
  persistSchedules(walletKey, next);
  return updated;
}

export function cancelAutopaySchedule(
  walletKey: string,
  id: string,
): AutopayScheduleRecord {
  return updateAutopaySchedule(walletKey, id, { status: 'cancelled' });
}

// ── Next Payment Calculation ────────────────────────────────────────────────

/**
 * Find the earliest upcoming scheduled payment date across active schedules
 * (optionally filtered to a specific credit line).
 */
export function getNextScheduledPayment(
  schedules: readonly AutopayScheduleRecord[],
  creditLineId?: string,
  today: Date = new Date(),
): NextScheduledPayment | null {
  const todayStr = toLocalDateString(today);
  let best: NextScheduledPayment | null = null;

  for (const schedule of schedules) {
    if (schedule.status !== 'active') continue;
    if (creditLineId && schedule.creditLineId !== creditLineId) continue;

    const dates = buildSchedule(schedule.startDate, schedule.frequency, schedule.endDate, 24);
    const nextDate = dates
      .map((d) => toLocalDateString(d))
      .find((dateStr) => dateStr >= todayStr);

    if (!nextDate) continue;
    if (!best || nextDate < best.date) {
      best = {
        schedule,
        date: nextDate,
        amount: schedule.amount,
      };
    }
  }

  return best;
}

// ── React Hooks ─────────────────────────────────────────────────────────────

export function useAutopaySchedulesForWallet(walletKey: string | null) {
  const [schedules, setSchedules] = useState<AutopayScheduleRecord[]>(() =>
    listAutopaySchedules(walletKey),
  );

  useEffect(() => {
    setSchedules(listAutopaySchedules(walletKey));
  }, [walletKey]);

  useEffect(() => {
    if (!walletKey || typeof window === 'undefined') return;
    const expectedKey = autopaySchedulesStorageKey(walletKey);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === expectedKey) {
        setSchedules(listAutopaySchedules(walletKey));
      }
    };

    const handleLocalSync = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || detail.key === expectedKey) {
        setSchedules(listAutopaySchedules(walletKey));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(AUTOPAY_SYNC_EVENT, handleLocalSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(AUTOPAY_SYNC_EVENT, handleLocalSync);
    };
  }, [walletKey]);

  const create = useCallback(
    (input: CreateAutopayScheduleInput): AutopayScheduleRecord => {
      assertValidWalletKey(walletKey);
      const created = createAutopaySchedule(walletKey, input);
      setSchedules(listAutopaySchedules(walletKey));
      return created;
    },
    [walletKey],
  );

  const update = useCallback(
    (id: string, patch: UpdateAutopayScheduleInput): AutopayScheduleRecord => {
      assertValidWalletKey(walletKey);
      const updated = updateAutopaySchedule(walletKey, id, patch);
      setSchedules(listAutopaySchedules(walletKey));
      return updated;
    },
    [walletKey],
  );

  const cancel = useCallback(
    (id: string): AutopayScheduleRecord => {
      assertValidWalletKey(walletKey);
      const cancelled = cancelAutopaySchedule(walletKey, id);
      setSchedules(listAutopaySchedules(walletKey));
      return cancelled;
    },
    [walletKey],
  );

  const activeSchedules = useMemo(
    () => schedules.filter((item) => item.status === 'active'),
    [schedules],
  );

  const nextPayment = useMemo(
    () => getNextScheduledPayment(activeSchedules),
    [activeSchedules],
  );

  return {
    schedules,
    activeSchedules,
    nextPayment,
    create,
    update,
    cancel,
  };
}

export function useAutopaySchedules() {
  const walletKey = useWalletIdentityKey();
  return useAutopaySchedulesForWallet(walletKey);
}
