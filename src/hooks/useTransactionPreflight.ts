import { useState, useCallback, useMemo, useContext } from 'react';
import { WalletContext } from '../context/WalletContext';
import { EXPECTED_NETWORK, switchNetwork } from '../utils/wallet';
import {
  evaluatePreflight,
  getPreflightIdentityKey,
  normalizeNetwork,
} from '../utils/transactionPreflight';
import type { WalletInfo, ConnectionStatus } from '../types/wallet';
import type { PreflightCheckResult } from '../types/transactionPreflight';

/**
 * Configuration options for the transaction preflight hook.
 */
export interface UseTransactionPreflightOptions {
  expectedNetwork?: string;
  expectedAccount?: string | null;
  initialIdentityKey?: string | null;
  walletOverride?: WalletInfo | null;
  statusOverride?: ConnectionStatus;
  refreshIdentityOverride?: () => Promise<void>;
  onExecuteTransaction?: () => Promise<void> | void;
}

/**
 * Return type for useTransactionPreflight.
 */
export interface UseTransactionPreflightReturn {
  preflight: PreflightCheckResult;
  canSign: boolean;
  isSwitching: boolean;
  isExecuting: boolean;
  switchError: string | null;
  executionError: string | null;
  handleSwitchNetwork: () => Promise<boolean>;
  executeSafeSubmit: () => Promise<boolean>;
  acknowledgeIdentityChange: () => void;
  clearErrors: () => void;
}

/**
 * Hook to enforce preflight network, account authority, and identity checks before signing.
 *
 * @param options Expected network, authority account, and execution handlers.
 * @returns Preflight evaluation state and safe execution controls.
 */
export function useTransactionPreflight(
  options: UseTransactionPreflightOptions = {},
): UseTransactionPreflightReturn {
  const context = useContext(WalletContext);

  const wallet = options.walletOverride !== undefined ? options.walletOverride : context?.wallet ?? null;
  const status = options.statusOverride !== undefined ? options.statusOverride : context?.status ?? 'disconnected';
  const refreshWalletIdentity = options.refreshIdentityOverride ?? context?.refreshWalletIdentity;

  const expectedNetwork = normalizeNetwork(options.expectedNetwork || EXPECTED_NETWORK);
  const expectedAccount = options.expectedAccount?.trim() || null;

  const [initialIdentityKey] = useState<string | null>(() => {
    if (options.initialIdentityKey !== undefined) {
      return options.initialIdentityKey;
    }
    return getPreflightIdentityKey(wallet);
  });

  const [acknowledgedIdentityKey, setAcknowledgedIdentityKey] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const activeIdentityKey = acknowledgedIdentityKey ?? initialIdentityKey;

  const preflight = useMemo(() => {
    return evaluatePreflight({
      wallet,
      status,
      expectedNetwork,
      expectedAccount,
      initialIdentityKey: activeIdentityKey,
    });
  }, [wallet, status, expectedNetwork, expectedAccount, activeIdentityKey]);

  const canSign = preflight.canSign && !isSwitching && !isExecuting;

  const handleSwitchNetwork = useCallback(async (): Promise<boolean> => {
    if (!wallet) {
      setSwitchError('Cannot switch network without a connected wallet.');
      return false;
    }

    setIsSwitching(true);
    setSwitchError(null);

    try {
      await switchNetwork(wallet.type, expectedNetwork);
      if (refreshWalletIdentity) {
        await refreshWalletIdentity();
      }
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to switch network to ${expectedNetwork}.`;
      setSwitchError(message);
      return false;
    } finally {
      setIsSwitching(false);
    }
  }, [wallet, expectedNetwork, refreshWalletIdentity]);

  const executeSafeSubmit = useCallback(async (): Promise<boolean> => {
    const currentEvaluation = evaluatePreflight({
      wallet,
      status,
      expectedNetwork,
      expectedAccount,
      initialIdentityKey: activeIdentityKey,
    });

    if (!currentEvaluation.canSign) {
      setExecutionError(currentEvaluation.blockReason || 'Transaction signing blocked.');
      return false;
    }

    if (!options.onExecuteTransaction) {
      return true;
    }

    setIsExecuting(true);
    setExecutionError(null);
    try {
      await options.onExecuteTransaction();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Transaction submission failed.';
      setExecutionError(message);
      return false;
    } finally {
      setIsExecuting(false);
    }
  }, [wallet, status, expectedNetwork, expectedAccount, activeIdentityKey, options]);

  const acknowledgeIdentityChange = useCallback(() => {
    const currentKey = getPreflightIdentityKey(wallet);
    setAcknowledgedIdentityKey(currentKey);
    setExecutionError(null);
  }, [wallet]);

  const clearErrors = useCallback(() => {
    setSwitchError(null);
    setExecutionError(null);
  }, []);

  return {
    preflight,
    canSign,
    isSwitching,
    isExecuting,
    switchError,
    executionError,
    handleSwitchNetwork,
    executeSafeSubmit,
    acknowledgeIdentityChange,
    clearErrors,
  };
}
