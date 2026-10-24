import type { CreditLine } from '@/types/creditLine';

const primary: CreditLine = {
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
  transactions: [],
  statusHistory: [],
  aprHistory: [],
};

const secondary: CreditLine = {
  ...primary,
  id: 'CL-2024-002',
  name: 'Secondary Line',
  limit: 100000,
  utilized: 45000,
  apr: 12,
  riskScore: 680,
  collateral: undefined,
  openedAt: '2024-06-01',
  nextPaymentDate: '2025-03-15',
  nextPaymentAmount: 1200,
};

const testLines: CreditLine[] = [
  { ...primary, id: 'CL-TEST-001', name: 'Test Business Line', limit: 100000, utilized: 85000, apr: 9, collateral: 'Equipment' },
  { ...primary, id: 'CL-TEST-002', name: 'Low Use Line', limit: 50000, utilized: 10000, apr: 7.5 },
  { ...primary, id: 'CL-TEST-003', name: 'Mid Use Line', limit: 40000, utilized: 26000, apr: 8 },
];

export const REPAY_TEST_CREDIT_LINES: CreditLine[] = [primary, secondary, ...testLines];
export const REPAY_EMPTY_CREDIT_LINES: CreditLine[] = [];
