import type { CreditLine, AprHistoryEntry } from '../types/creditLine';
import type { Attestation } from '../types/attestation';

// ─── History cursor state ────────────────────────────────────────────────────
/**
 * Stores the next pagination cursor per history filter signature. When filters
 * change, call `resetHistoryCursors` so stale cursors cannot be reused.
 */
const historyCursors = new Map<string, string | null>();

/**
 * Clears history cursors. With no arguments, clears all cursors. When a filter
 * key is supplied, only that filter's cursor is cleared.
 */
export function resetHistoryCursors(filterKey?: string): void {
  if (filterKey === undefined) {
    historyCursors.clear();
  } else {
    historyCursors.delete(filterKey);
  }
}

export function getHistoryCursor(filterKey: string): string | null {
  return historyCursors.get(filterKey) ?? null;
}

export function setHistoryCursor(filterKey: string, cursor: string | null): void {
  if (cursor === null) {
    historyCursors.delete(filterKey);
  } else {
    historyCursors.set(filterKey, cursor);
  }
}

// ─── APR history generation helper ───────────────────────────────────────────
/**
 * Generates a realistic-looking APR history for the past `days` days.
 * Uses a simple bounded random walk anchored to `currentApr`.
 * Deterministic seed per credit-line id keeps snapshots stable.
 */
function generateAprHistory(
  currentApr: number,
  days = 365,
  seed = 42,
): AprHistoryEntry[] {
  const entries: AprHistoryEntry[] = [];
  // Park the pseudo-random walk at currentApr at T=0 and walk backwards
  let apr = currentApr;
  const now = new Date();

  // Simple LCG PRNG for stable, deterministic sequences
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };

  // Build from oldest to newest
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    // Small daily drift ±0.05 pp, clamped to ±2 pp from opening APR
    const drift = (rand() - 0.5) * 0.1;
    apr = Math.max(currentApr - 2, Math.min(currentApr + 2, apr + drift));
    entries.push({
      date: date.toISOString().slice(0, 10),
      apr: Math.round(apr * 100) / 100,
    });
  }
  return entries;
}

/**
 * Canonical deterministic ordering for credit lines.
 *
 * The unique id is the primary sort key; openedAt and name are tie-breakers
 * for duplicate or malformed ids so the sort never depends on array position.
 */
export function compareCreditLines(a: CreditLine, b: CreditLine): number {
  const aId = String(a.id);
  const bId = String(b.id);
  if (aId !== bId) return aId < bId ? -1 : 1;
  const aOpenedAt = String(a.openedAt);
  const bOpenedAt = String(b.openedAt);
  if (aOpenedAt !== bOpenedAt) return aOpenedAt < bOpenedAt ? -1 : 1;
  const aName = String(a.name);
  const bName = String(b.name);
  if (aName !== bName) return aName < bName ? -1 : 1;
  return 0;
}

export const MOCK_CREDIT_LINES: CreditLine[] = [
  {
    id: 'CL-2024-001',
    name: 'Primary Business Line',
    status: 'Active',
    limit: 500000,
    utilized: 187500,
    apr: 8.5,
    riskScore: 720,
    collateral: 'Commercial Real Estate',
    openedAt: '2024-03-15',
    updatedAt: '2025-02-20T14:32:00Z',
    nextPaymentDate: '2025-03-01',
    nextPaymentAmount: 3200,
    nextInterestAccrualDate: '2025-03-01',
    transactions: [
      { id: 'TX-001', type: 'Draw', amount: 50000, date: '2025-02-18T10:30:00Z', note: 'Equipment purchase', status: 'Completed', txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1' },
      { id: 'TX-002', type: 'Repay', amount: 12500, date: '2025-02-10T14:15:00Z', note: 'Monthly repayment', status: 'Completed', txHash: 'def789012def789012def789012def789012def789012def789012def789012d' },
      { id: 'TX-003', type: 'Draw', amount: 150000, date: '2025-01-22T09:45:00Z', note: 'Inventory expansion', status: 'Completed', txHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' },
      { id: 'TX-004', type: 'Interest', amount: 1328, date: '2025-02-01T00:00:00Z', note: 'Monthly interest accrual', status: 'Completed' },
      { id: 'TX-005', type: 'Draw', amount: 25000, date: '2025-01-15T11:20:00Z', note: 'Marketing campaign', status: 'Completed', txHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' },
      { id: 'TX-006', type: 'Repay', amount: 8000, date: '2024-12-20T16:00:00Z', note: 'Emergency repayment', status: 'Completed', txHash: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210' },
    ],
    statusHistory: [
      { status: 'Active', date: '2024-03-15', note: 'Line opened and activated' },
    ],
    aprHistory: generateAprHistory(8.5, 365, 101),
  },
  {
    id: 'CL-2024-002',
    name: 'Expansion Capital Line',
    status: 'Active',
    limit: 250000,
    utilized: 210000,
    apr: 9.25,
    riskScore: 685,
    collateral: 'Accounts Receivable',
    openedAt: '2024-06-01',
    updatedAt: '2025-02-19T09:15:00Z',
    nextPaymentDate: '2025-03-05',
    nextPaymentAmount: 5100,
    nextInterestAccrualDate: '2025-03-01',
    transactions: [
      { id: 'TX-007', type: 'Draw', amount: 100000, date: '2025-02-05T08:30:00Z', note: 'Market expansion', status: 'Completed', txHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' },
      { id: 'TX-008', type: 'Repay', amount: 40000, date: '2025-01-28T13:45:00Z', note: 'Partial repayment', status: 'Completed', txHash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
      { id: 'TX-009', type: 'Interest', amount: 1620, date: '2025-02-01T00:00:00Z', note: 'Monthly interest', status: 'Completed' },
      { id: 'TX-010', type: 'Draw', amount: 75000, date: '2025-01-10T10:00:00Z', note: 'Hiring new staff', status: 'Completed', txHash: 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' },
      { id: 'TX-011', type: 'Repay', amount: 25000, date: '2024-12-15T15:30:00Z', note: 'Quarterly payment', status: 'Completed', txHash: 'a0b1c2d3e4f5a6b7a0b1c2d3e4f5a6b7a0b1c2d3e4f5a6b7a0b1c2d3e4f5a6b7' },
      { id: 'TX-012', type: 'Draw', amount: 50000, date: '2024-11-20T09:15:00Z', note: 'Software upgrade', status: 'Completed', txHash: 'f0e1d2c3b4a59687f0e1d2c3b4a59687f0e1d2c3b4a59687f0e1d2c3b4a59687' },
      { id: 'TX-013', type: 'Interest', amount: 1450, date: '2025-01-01T00:00:00Z', note: 'Monthly interest', status: 'Completed' },
    ],
    statusHistory: [
      { status: 'Active', date: '2024-06-01', note: 'Line opened' },
    ],
    aprHistory: generateAprHistory(9.25, 365, 202),
  },
  {
    id: 'CL-2023-003',
    name: 'Working Capital Facility',
    status: 'Suspended',
    limit: 100000,
    utilized: 45000,
    apr: 11.0,
    riskScore: 610,
    openedAt: '2023-11-10',
    updatedAt: '2025-01-15T16:45:00Z',
    nextInterestAccrualDate: '2025-02-01',
    transactions: [
      { id: 'TX-014', type: 'Draw', amount: 45000, date: '2024-12-10T12:00:00Z', note: 'Operations', status: 'Completed', txHash: 'aaa111bbb222ccc333ddd444eee555fff666aaa111bbb222ccc333ddd444eee5' },
      { id: 'TX-015', type: 'Interest', amount: 413, date: '2025-01-01T00:00:00Z', note: 'Monthly interest', status: 'Completed' },
      { id: 'TX-016', type: 'StatusChange', amount: 0, date: '2025-01-15T16:45:00Z', note: 'Missed payment — suspended', status: 'Completed' },
    ],
    statusHistory: [
      { status: 'Active', date: '2023-11-10', note: 'Line opened' },
      { status: 'Suspended', date: '2025-01-15', note: 'Missed payment — under review' },
    ],
    aprHistory: generateAprHistory(11.0, 365, 303),
  },
  {
    id: 'CL-2023-004',
    name: 'Emergency Reserve Line',
    status: 'Defaulted',
    limit: 75000,
    utilized: 75000,
    apr: 14.5,
    riskScore: 490,
    openedAt: '2023-05-20',
    updatedAt: '2024-11-01T10:00:00Z',
    transactions: [
      { id: 'TX-017', type: 'Draw', amount: 75000, date: '2024-03-15T14:30:00Z', note: 'Full draw', status: 'Completed', txHash: 'ccc333ddd444eee555fff666ccc333ddd444eee555fff666ccc333ddd444eee5' },
      { id: 'TX-018', type: 'Fee', amount: 750, date: '2024-11-01T10:00:00Z', note: 'Default fee applied', status: 'Completed' },
      { id: 'TX-019', type: 'StatusChange', amount: 0, date: '2024-09-01T09:00:00Z', note: 'Payment overdue — suspended', status: 'Completed' },
      { id: 'TX-020', type: 'StatusChange', amount: 0, date: '2024-11-01T10:00:00Z', note: '90+ days overdue — defaulted', status: 'Completed' },
      { id: 'TX-021', type: 'Interest', amount: 2800, date: '2024-08-01T00:00:00Z', note: 'Interest accrued', status: 'Completed' },
      { id: 'TX-022', type: 'Interest', amount: 2950, date: '2024-09-01T00:00:00Z', note: 'Interest accrued', status: 'Completed' },
      { id: 'TX-023', type: 'Interest', amount: 3100, date: '2024-10-01T00:00:00Z', note: 'Interest accrued', status: 'Pending' },
    ],
    statusHistory: [
      { status: 'Active', date: '2023-05-20', note: 'Line opened' },
      { status: 'Suspended', date: '2024-09-01', note: 'Payment overdue' },
      { status: 'Defaulted', date: '2024-11-01', note: '90+ days overdue' },
    ],
    aprHistory: generateAprHistory(14.5, 365, 404),
  },
  {
    id: 'CL-2022-005',
    name: 'Startup Seed Line',
    status: 'Closed',
    limit: 50000,
    utilized: 0,
    apr: 10.0,
    riskScore: 740,
    openedAt: '2022-08-01',
    updatedAt: '2024-06-30T12:00:00Z',
    transactions: [
      { id: 'TX-024', type: 'Draw', amount: 30000, date: '2022-09-01T10:00:00Z', note: 'Initial draw', status: 'Completed', txHash: 'eee555fff666aaa111bbb222ccc333ddd444eee555fff666aaa111bbb222ccc3' },
      { id: 'TX-025', type: 'Repay', amount: 30000, date: '2023-06-15T15:00:00Z', note: 'Full repayment', status: 'Completed', txHash: 'fff666eee555ddd444ccc333bbb222aaa111fff666eee555ddd444ccc333bbb2' },
      { id: 'TX-026', type: 'StatusChange', amount: 0, date: '2024-06-30T12:00:00Z', note: 'Line closed', status: 'Completed' },
    ],
    statusHistory: [
      { status: 'Active', date: '2022-08-01', note: 'Line opened' },
      { status: 'Closed', date: '2024-06-30', note: 'Fully repaid and closed by borrower' },
    ],
    aprHistory: generateAprHistory(10.0, 365, 505),
  },
  {
    id: 'CL-2025-006',
    name: 'Revolving Credit Line',
    status: 'Active',
    limit: 100000,
    utilized: 0,
    apr: 7.5,
    riskScore: 750,
    collateral: 'USDC Treasury',
    openedAt: '2025-01-15',
    updatedAt: '2025-02-20T10:00:00Z',
    nextInterestAccrualDate: '2025-03-15',
    transactions: [
      { id: 'TX-027', type: 'Draw', amount: 15000, date: '2025-02-15T09:00:00Z', note: 'Initial funding', status: 'Completed', txHash: '0a1b2c3d4e5f0a1b2c3d4e5f0a1b2c3d4e5f0a1b2c3d4e5f0a1b2c3d4e5f0a1b' },
      { id: 'TX-028', type: 'Repay', amount: 15000, date: '2025-02-18T11:30:00Z', note: 'Quick repayment', status: 'Completed', txHash: 'f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4d3c2b1a0f5e4' },
    ],
    statusHistory: [
      { status: 'Active', date: '2025-01-15', note: 'Line opened and activated' },
    ],
    aprHistory: generateAprHistory(7.5, 365, 606),
  },
].sort(compareCreditLines);

// ─── Attestations mock data ───────────────────────────────────────────────────

export const MOCK_ATTESTATIONS: Attestation[] = [
  {
    id: 'identity-bond',
    label: 'Identity Bond',
    lastVerifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
    remediationStep: 2,
  },
  {
    id: 'revenue-proof',
    label: 'Revenue Proof',
    lastVerifiedAt: new Date(Date.now() - 170 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    remediationStep: 2,
  },
  {
    id: 'bank-ownership',
    label: 'Bank Account Ownership',
    remediationStep: 2,
  },
];

// ─── Sessions mock data ───────────────────────────────────────────────────────
import type { Session } from '../types/session';

/**
 * Mock active sessions returned by the /auth/sessions endpoint.
 *
 * The first entry (`sess-001`) is flagged `isCurrent: true` to represent the
 * in-progress browser session.  The rest simulate sessions from other devices.
 */
export const MOCK_SESSIONS: Session[] = [
  {
    id: 'sess-001',
    isCurrent: true,
    deviceLabel: 'Chrome 124 on macOS',
    deviceType: 'desktop',
    ipAddress: '203.0.113.42',
    location: 'San Francisco, CA, US',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),       // 2 h ago
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'sess-002',
    isCurrent: false,
    deviceLabel: 'Safari on iPhone',
    deviceType: 'mobile',
    ipAddress: '198.51.100.7',
    location: 'New York, NY, US',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),  // 3 d ago
    lastActiveAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),    // 1 h ago
  },
  {
    id: 'sess-003',
    isCurrent: false,
    deviceLabel: 'Firefox 125 on Windows',
    deviceType: 'desktop',
    ipAddress: '192.0.2.188',
    location: 'Austin, TX, US',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 d ago
    lastActiveAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sess-004',
    isCurrent: false,
    deviceLabel: 'Chrome on Android',
    deviceType: 'mobile',
    ipAddress: '203.0.113.99',
    location: 'London, UK',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastActiveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'sess-005',
    isCurrent: false,
    deviceLabel: 'Safari on iPad',
    deviceType: 'tablet',
    ipAddress: '198.51.100.55',
    location: 'Toronto, ON, CA',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActiveAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
