import React from 'react';
import { useTransactionPreflight, UseTransactionPreflightOptions, UseTransactionPreflightReturn } from '../hooks/useTransactionPreflight';
import { TransactionConfirmationSummary } from './TransactionConfirmationSummary';

/**
 * Properties for TransactionPreflightGuard component.
 */
export interface TransactionPreflightGuardProps extends UseTransactionPreflightOptions {
  children?: React.ReactNode | ((preflightState: UseTransactionPreflightReturn) => React.ReactNode);
  showSummary?: boolean;
}

/**
 * Guard container component that enforces network and account authority preflight checks.
 *
 * @param props Configuration options, child render targets, and summary flags.
 * @returns Guarded container with preflight summary and safe execution state.
 */
export const TransactionPreflightGuard: React.FC<TransactionPreflightGuardProps> = ({
  children,
  showSummary = true,
  ...options
}) => {
  const preflightState = useTransactionPreflight(options);

  return (
    <div className="tx-preflight-guard" data-testid="transaction-preflight-guard">
      {showSummary && (
        <TransactionConfirmationSummary
          preflight={preflightState.preflight}
          canSign={preflightState.canSign}
          isSwitching={preflightState.isSwitching}
          switchError={preflightState.switchError}
          onSwitchNetwork={preflightState.handleSwitchNetwork}
          onAcknowledgeIdentityChange={preflightState.acknowledgeIdentityChange}
        />
      )}
      {typeof children === 'function' ? children(preflightState) : children}
    </div>
  );
};
