export type CreditLineStatus = 'Active' | 'Suspended' | 'Defaulted' | 'Closed';
export type SortField = 'status' | 'limit' | 'utilization' | 'updatedAt' | 'apr' | 'riskScore';
export type SortDirection = 'asc' | 'desc';
export type UtilizationLevel = 'low' | 'medium' | 'high';
export type TransactionType = 'Draw' | 'Repay' | 'Fee' | 'Interest' | 'StatusChange';
export type TransactionStatus = 'Completed' | 'Pending' | 'Failed';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  note?: string;
  status: TransactionStatus;
  txHash?: string;
}

export interface StatusHistoryEntry {
  status: CreditLineStatus;
  date: string;
  note?: string;
}

export interface CreditLine {
  id: string;
  name: string;
  status: CreditLineStatus;
  limit: number;
  utilized: number;
  apr: number;
  riskScore: number;
  collateral?: string;
  openedAt: string;
  updatedAt: string;
  transactions: Transaction[];
  statusHistory: StatusHistoryEntry[];
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
}
