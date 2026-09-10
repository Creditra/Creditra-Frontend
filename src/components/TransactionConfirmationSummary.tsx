import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, ArrowRightLeft, RefreshCw } from 'lucide-react';
import type { PreflightCheckResult } from '../types/transactionPreflight';
import { shortenAddress } from '../utils/format-address';
import './TransactionPreflightGuard.css';

/**
 * Properties for the TransactionConfirmationSummary component.
 */
export interface TransactionConfirmationSummaryProps {
  preflight: PreflightCheckResult;
  canSign: boolean;
  isSwitching?: boolean;
  switchError?: string | null;
  onSwitchNetwork?: () => void;
  onAcknowledgeIdentityChange?: () => void;
}

/**
 * Visual confirmation summary displaying network and account preflight verification.
 *
 * @param props Preflight status, verification outcomes, and switch actions.
 * @returns Accessible confirmation summary card.
 */
export const TransactionConfirmationSummary: React.FC<TransactionConfirmationSummaryProps> = ({
  preflight,
  canSign,
  isSwitching = false,
  switchError = null,
  onSwitchNetwork,
  onAcknowledgeIdentityChange,
}) => {
  const {
    status,
    isNetworkMatch,
    isAccountMatch,
    isIdentityFresh,
    connectedNetwork,
    expectedNetwork,
    connectedAccount,
    expectedAccount,
    blockReason,
  } = preflight;

  return (
    <div
      className="tx-preflight-summary"
      data-testid="transaction-preflight-summary"
      aria-label="Transaction preflight confirmation summary"
    >
      <div className="tx-preflight-summary__header">
        <h4 className="tx-preflight-summary__title">Preflight Verification</h4>
        <span
          className={`tx-preflight-summary__status-badge ${
            canSign
              ? 'tx-preflight-summary__status-badge--ready'
              : 'tx-preflight-summary__status-badge--blocked'
          }`}
          data-testid="preflight-status-badge"
        >
          {canSign ? (
            <>
              <CheckCircle size={14} aria-hidden="true" />
              <span>Ready to Sign</span>
            </>
          ) : (
            <>
              <XCircle size={14} aria-hidden="true" />
              <span>Signing Blocked</span>
            </>
          )}
        </span>
      </div>

      <div className="tx-preflight-summary__grid">
        <div className="tx-preflight-summary__item" data-testid="preflight-network-item">
          <div className="tx-preflight-summary__item-label">
            <span>Network Authority</span>
            <span
              className={`tx-preflight-summary__badge ${
                isNetworkMatch
                  ? 'tx-preflight-summary__badge--match'
                  : 'tx-preflight-summary__badge--mismatch'
              }`}
              data-testid="network-match-badge"
            >
              {isNetworkMatch ? 'Match' : 'Mismatch'}
            </span>
          </div>
          <div className="tx-preflight-summary__item-value">
            <span>Required: {expectedNetwork}</span>
            <span style={{ color: 'var(--muted, #8b949e)' }}>/</span>
            <span>Active: {connectedNetwork || 'None'}</span>
          </div>
        </div>

        <div className="tx-preflight-summary__item" data-testid="preflight-account-item">
          <div className="tx-preflight-summary__item-label">
            <span>Signer Account</span>
            <span
              className={`tx-preflight-summary__badge ${
                isAccountMatch
                  ? 'tx-preflight-summary__badge--match'
                  : 'tx-preflight-summary__badge--mismatch'
              }`}
              data-testid="account-match-badge"
            >
              {isAccountMatch ? 'Match' : 'Mismatch'}
            </span>
          </div>
          <div className="tx-preflight-summary__item-value">
            {expectedAccount ? (
              <>
                <span title={expectedAccount}>Req: {shortenAddress(expectedAccount)}</span>
                <span style={{ color: 'var(--muted, #8b949e)' }}>/</span>
                <span title={connectedAccount || ''}>
                  Act: {connectedAccount ? shortenAddress(connectedAccount) : 'None'}
                </span>
              </>
            ) : (
              <span title={connectedAccount || ''}>
                Connected: {connectedAccount ? shortenAddress(connectedAccount) : 'None'}
              </span>
            )}
          </div>
        </div>
      </div>

      {!canSign && blockReason && (
        <div
          role="alert"
          aria-live="polite"
          className="tx-preflight-summary__alert tx-preflight-summary__alert--warning"
          data-testid="preflight-block-alert"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Action required:</strong> {blockReason}
            </div>
          </div>

          {!isNetworkMatch && onSwitchNetwork && (
            <div className="tx-preflight-summary__alert-actions">
              <button
                type="button"
                className="tx-preflight-summary__switch-button"
                onClick={onSwitchNetwork}
                disabled={isSwitching}
                data-testid="switch-network-action-button"
                aria-label={`Switch network to ${expectedNetwork}`}
              >
                {isSwitching ? (
                  <>
                    <RefreshCw size={14} className="spin" aria-hidden="true" />
                    <span>Switching to {expectedNetwork}...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={14} aria-hidden="true" />
                    <span>Switch to {expectedNetwork}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {!isIdentityFresh && onAcknowledgeIdentityChange && (
            <div className="tx-preflight-summary__alert-actions">
              <button
                type="button"
                className="tx-preflight-summary__secondary-button"
                onClick={onAcknowledgeIdentityChange}
                data-testid="acknowledge-identity-button"
              >
                Accept updated account authority
              </button>
            </div>
          )}
        </div>
      )}

      {switchError && (
        <div
          role="alert"
          aria-live="assertive"
          className="tx-preflight-summary__alert tx-preflight-summary__alert--error"
          data-testid="switch-network-error-alert"
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <XCircle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Network switch failed:</strong> {switchError}
              <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', opacity: 0.9 }}>
                Please switch your wallet network to {expectedNetwork} manually in your wallet extension.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
