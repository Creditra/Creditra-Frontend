import { useState } from 'react';
import { useTransactionPreflight } from '../hooks/useTransactionPreflight';
import { TransactionConfirmationSummary } from '../components/TransactionConfirmationSummary';
import { EXPECTED_NETWORK } from '../utils/wallet';
import type { WalletInfo, ConnectionStatus } from '../types/wallet';

export interface AmountConfirmProps {
  /** The monetary amount to confirm (USD). */
  amount: number;
  /** Called when the user confirms the amount. */
  onConfirm: () => void;
  /** Called when the user cancels. */
  onCancel?: () => void;
  /** Label for the confirm button. Default "Confirm". */
  confirmLabel?: string;
  /** Additional CSS class names. */
  className?: string;
  /** Whether to enable transaction preflight checks (network and account validation). */
  enablePreflight?: boolean;
  /** Expected network for preflight verification. */
  expectedNetwork?: string;
  /** Expected signer account public key. */
  expectedAccount?: string;
  /** Optional wallet override. */
  walletOverride?: WalletInfo | null;
  /** Optional status override. */
  statusOverride?: ConnectionStatus;
}

/**
 * AmountConfirm — typed amount confirmation step with print hooks.
 *
 * Before executing a high-value operation (draw / repay above threshold),
 * the user must type the exact dollar amount to confirm intentionality.
 * This guards against fat-finger errors and provides a clear signal
 * of irreversible action.
 *
 * Print hooks: When printed, the interactive input and buttons are hidden
 * via `src/styles/print-settings.css` so the page renders a clean record
 * of the confirmed amount.
 *
 * WCAG 2.1 AA:
 * - Input has an explicit `<label>`.
 * - Error message uses `role="alert"`.
 * - Confirm button stays disabled until the typed amount matches.
 *
 * Usage:
 * ```tsx
 * <AmountConfirm
 *   amount={5000}
 *   onConfirm={() => submit()}
 *   onCancel={() => goBack()}
 * />
 * ```
 */
export function AmountConfirm({
  amount,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  className = '',
  enablePreflight = false,
  expectedNetwork = EXPECTED_NETWORK,
  expectedAccount,
  walletOverride,
  statusOverride,
}: AmountConfirmProps) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const formattedAmount = `$${amount.toLocaleString()}`;

  const {
    preflight,
    canSign,
    isSwitching,
    switchError,
    handleSwitchNetwork,
    executeSafeSubmit,
    acknowledgeIdentityChange,
  } = useTransactionPreflight({
    expectedNetwork,
    expectedAccount,
    walletOverride,
    statusOverride,
    onExecuteTransaction: onConfirm,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTyped(e.target.value);
    setError('');
  };

  const isMatch = typed.trim() === String(amount);
  const canProceed = isMatch && (enablePreflight ? canSign && !isSwitching : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatch) {
      setError(`Please type exactly "${amount}" to confirm.`);
      return;
    }

    if (enablePreflight) {
      await executeSafeSubmit();
    } else {
      onConfirm();
    }
  };

  const classes = ['card', 'amount-confirm', className]
    .filter(Boolean)
    .join(' ');

  return (
    <form
      className={classes}
      onSubmit={handleSubmit}
      aria-labelledby="amount-confirm-heading"
    >
      <h2 id="amount-confirm-heading" className="amount-confirm__title">
        Confirm Amount
      </h2>
      <p className="amount-confirm__instruction">
        Type{' '}
        <strong className="num-tabular">{formattedAmount}</strong>
        {' '}to confirm this action.
      </p>

      {error && (
        <div className="amount-confirm__error" role="alert">
          {error}
        </div>
      )}

      <label className="amount-confirm__label" htmlFor="amount-confirm-input">
        Type the amount to confirm:
      </label>
      <input
        id="amount-confirm-input"
        className="amount-confirm__input"
        type="text"
        inputMode="numeric"
        value={typed}
        onChange={handleChange}
        placeholder={String(amount)}
        autoComplete="off"
      />

      {enablePreflight && (
        <TransactionConfirmationSummary
          preflight={preflight}
          canSign={canSign}
          isSwitching={isSwitching}
          switchError={switchError}
          onSwitchNetwork={handleSwitchNetwork}
          onAcknowledgeIdentityChange={acknowledgeIdentityChange}
        />
      )}

      <div className="amount-confirm__actions">
        {onCancel && (
          <button
            type="button"
            className="amount-confirm__btn amount-confirm__btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="amount-confirm__btn amount-confirm__btn--confirm"
          aria-disabled={!canProceed}
        >
          {confirmLabel}
        </button>
      </div>
    </form>
  );
}

export default AmountConfirm;
