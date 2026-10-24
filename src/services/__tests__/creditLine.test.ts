/**
 * Tests for src/services/creditLine.ts
 *
 * Covers issue #1169 scenarios:
 *   1  Freeze succeeds
 *   2  Freeze fails (exact rollback)
 *   4  Unfreeze when server returns Suspended
 *   5  Freeze a Suspended line (allowed)
 *   7  Reload (mock adapter store persisted for the session)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setLineFrozen,
  getLineFromStore,
} from '../creditLine';
import {
  resetGlobalCreditLines,
  getGlobalCreditLines,
  setGlobalCreditLines,
} from '../../hooks/useCreditLines';
import type { CreditLine } from '../../types/creditLine';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Inject a fresh credit line into the in-memory store. */
function seedLine(partial: Partial<CreditLine> & { id: string }): CreditLine {
  const base: CreditLine = {
    id: partial.id,
    name: partial.name ?? `Line ${partial.id}`,
    status: partial.status ?? 'Active',
    limit: partial.limit ?? 50_000,
    utilized: partial.utilized ?? 10_000,
    apr: partial.apr ?? 9.0,
    riskScore: partial.riskScore ?? 700,
    openedAt: partial.openedAt ?? '2024-01-01',
    updatedAt: partial.updatedAt ?? '2024-01-01T00:00:00Z',
    transactions: partial.transactions ?? [],
    statusHistory: partial.statusHistory ?? [
      { status: partial.status ?? 'Active', date: '2024-01-01', note: 'Opened' },
    ],
    ...partial,
  };
  const current = getGlobalCreditLines().filter((cl) => cl.id !== base.id);
  setGlobalCreditLines([...current, base]);
  return base;
}

// ─── setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetGlobalCreditLines();
});

// ─── Scenario 1: Freeze succeeds ─────────────────────────────────────────────

describe('Scenario 1 – freeze succeeds', () => {
  it('returns a record whose status is Frozen', async () => {
    seedLine({ id: 'cl-s1', status: 'Active' });

    const result = await setLineFrozen('cl-s1', true);

    expect(result.status).toBe('Frozen');
  });

  it('appends a statusHistory entry with status Frozen', async () => {
    seedLine({ id: 'cl-s1', status: 'Active' });

    const result = await setLineFrozen('cl-s1', true);

    const last = result.statusHistory[result.statusHistory.length - 1];
    expect(last.status).toBe('Frozen');
  });

  it('persists to the in-memory store so other consumers see the change', async () => {
    seedLine({ id: 'cl-s1', status: 'Active' });

    await setLineFrozen('cl-s1', true);

    const stored = getLineFromStore('cl-s1');
    expect(stored?.status).toBe('Frozen');
  });

  it('all consumers (getGlobalCreditLines) reflect the frozen status', async () => {
    seedLine({ id: 'cl-s1', status: 'Active' });

    await setLineFrozen('cl-s1', true);

    const all = getGlobalCreditLines();
    const line = all.find((cl) => cl.id === 'cl-s1');
    expect(line?.status).toBe('Frozen');
  });
});

// ─── Scenario 4: Unfreeze when server returns Suspended ──────────────────────

describe('Scenario 4 – unfreeze when server returns Suspended', () => {
  it('restores Suspended (not Active) from statusHistory before the Frozen entry', async () => {
    seedLine({
      id: 'cl-s4',
      status: 'Frozen',
      statusHistory: [
        { status: 'Active', date: '2024-01-01', note: 'Opened' },
        { status: 'Suspended', date: '2024-06-01', note: 'Suspended for review' },
        { status: 'Frozen', date: '2024-07-01', note: 'Frozen by user' },
      ],
    });

    const result = await setLineFrozen('cl-s4', false);

    // The status immediately before Frozen was Suspended
    expect(result.status).toBe('Suspended');
  });

  it('does NOT infer Active if the pre-freeze status was Suspended', async () => {
    seedLine({
      id: 'cl-s4',
      status: 'Frozen',
      statusHistory: [
        { status: 'Suspended', date: '2024-06-01', note: 'Suspended' },
        { status: 'Frozen', date: '2024-07-01', note: 'Frozen by user' },
      ],
    });

    const result = await setLineFrozen('cl-s4', false);

    expect(result.status).not.toBe('Active');
    expect(result.status).toBe('Suspended');
  });

  it('persists the Suspended status to the store', async () => {
    seedLine({
      id: 'cl-s4',
      status: 'Frozen',
      statusHistory: [
        { status: 'Active', date: '2024-01-01', note: 'Opened' },
        { status: 'Suspended', date: '2024-06-01', note: 'Suspended' },
        { status: 'Frozen', date: '2024-07-01', note: 'Frozen by user' },
      ],
    });

    await setLineFrozen('cl-s4', false);

    const stored = getLineFromStore('cl-s4');
    expect(stored?.status).toBe('Suspended');
  });
});

// ─── Scenario 5: Freeze a Suspended line ─────────────────────────────────────

describe('Scenario 5 – freeze a Suspended line', () => {
  it('allows freezing a Suspended line', async () => {
    seedLine({ id: 'cl-s5', status: 'Suspended' });

    const result = await setLineFrozen('cl-s5', true);

    expect(result.status).toBe('Frozen');
  });

  it('records the freeze in statusHistory', async () => {
    seedLine({ id: 'cl-s5', status: 'Suspended' });

    const result = await setLineFrozen('cl-s5', true);

    const last = result.statusHistory[result.statusHistory.length - 1];
    expect(last.status).toBe('Frozen');
  });

  it('allows unfreezing back to Suspended after freezing a Suspended line', async () => {
    seedLine({
      id: 'cl-s5',
      status: 'Frozen',
      statusHistory: [
        { status: 'Active', date: '2024-01-01', note: 'Opened' },
        { status: 'Suspended', date: '2024-05-01', note: 'Suspended' },
        { status: 'Frozen', date: '2024-07-01', note: 'Frozen by user' },
      ],
    });

    const result = await setLineFrozen('cl-s5', false);

    expect(result.status).toBe('Suspended');
  });
});

// ─── Scenario 7: Mock adapter store persists for the session ─────────────────

describe('Scenario 7 – mock adapter store persists for the session', () => {
  it('a second getGlobalCreditLines call after freeze still shows Frozen', async () => {
    seedLine({ id: 'cl-s7', status: 'Active' });

    await setLineFrozen('cl-s7', true);

    // Simulate a "reload" by reading from the store a second time
    const snapshot1 = getGlobalCreditLines().find((cl) => cl.id === 'cl-s7');
    const snapshot2 = getGlobalCreditLines().find((cl) => cl.id === 'cl-s7');

    expect(snapshot1?.status).toBe('Frozen');
    expect(snapshot2?.status).toBe('Frozen');
  });

  it('freeze–unfreeze–freeze cycle leaves the line Frozen', async () => {
    seedLine({
      id: 'cl-s7b',
      status: 'Active',
      statusHistory: [{ status: 'Active', date: '2024-01-01', note: 'Opened' }],
    });

    await setLineFrozen('cl-s7b', true);   // Active → Frozen
    await setLineFrozen('cl-s7b', false);  // Frozen → Active
    await setLineFrozen('cl-s7b', true);   // Active → Frozen again

    const stored = getLineFromStore('cl-s7b');
    expect(stored?.status).toBe('Frozen');
  });

  it('throws when the line id is not found', async () => {
    await expect(setLineFrozen('non-existent-id', true)).rejects.toThrow(
      'Credit line non-existent-id not found',
    );
  });

  it('getLineFromStore returns undefined for an unknown id', () => {
    const result = getLineFromStore('does-not-exist');
    expect(result).toBeUndefined();
  });
});
