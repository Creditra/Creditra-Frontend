import type { WalletInfo, ConnectionStatus } from './wallet';

/**
 * Preflight validation status for a transaction.
 */
export type PreflightStatus =
  | 'ready'
  | 'disconnected'
  | 'wrong_network'
  | 'account_mismatch'
  | 'stale_identity'
  | 'switching';

/**
 * Result of evaluating transaction preflight conditions.
 */
export interface PreflightCheckResult {
  status: PreflightStatus;
  canSign: boolean;
  isNetworkMatch: boolean;
  isAccountMatch: boolean;
  isIdentityFresh: boolean;
  connectedAccount: string | null;
  connectedNetwork: string | null;
  expectedAccount: string | null;
  expectedNetwork: string;
  blockReason: string | null;
}

/**
 * Options configuring transaction preflight validation.
 */
export interface TransactionPreflightOptions {
  expectedNetwork?: string;
  expectedAccount?: string | null;
  initialIdentityKey?: string | null;
  wallet?: WalletInfo | null;
  status?: ConnectionStatus;
  onExecuteTransaction?: () => Promise<void> | void;
}
