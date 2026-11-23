import { useEffect, useId, useState, type RefObject } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import {
  formatMoney,
  parseAmountInput,
  requiresRepayConfirmation,
} from '../utils/amountValidation';
import { PendingButton } from './PendingButton';
import './TypedAmountConfirm.css';

/** Parse a user-typed currency string into a numeric amount. */
export function parseTypedAmount(value: string): number {
  return parseAmountInput(value, { allowCommas: false }) ?? 0;
}

/** Returns true when the typed value exactly matches the expected amount. */
export function isTypedAmountMatch(value: string, expectedAmount: number): boolean {
  return parseTypedAmount(value) === expectedAmount;
}

export interface TypedAmountConfirmFieldProps {
  /** Exact amount the user must type to confirm. */
  amount: number;
  /** Controlled input value. */
  value: string;
  /** Called when the input value changes. */
  onChange: (value: string) => void;
  /** Optional prefix for element ids when multiple fields appear on one page. */
  idPrefix?: string;
  className?: string;
}

/**
 * Embedded typed-amount confirmation field for use inside review steps.
 *
 * Pairs a labelled text input (type="text", inputMode="decimal") with hint
 * text and validation styling.  Using `type="text"` instead of `type="number"`
 * avoids browser-native spin-button UI and partial-input rejection that would
 * interfere with the exact-match check while the user is typing.
 *
 * The parent owns enable/disable logic for the primary action via
 * `isTypedAmountMatch(value, amount)`.
 */
export function TypedAmountConfirmField({
  amount,
  value,
  onChange,
  idPrefix = 'typed-amount-confirm',
  className = '',
}: TypedAmountConfirmFieldProps) {
  const inputId = `${idPrefix}-input`;
  const hintId = `${idPrefix}-hint`;
  const helperId = `${idPrefix}-helper`;
  const isMatch = isTypedAmountMatch(value, amount);
  const hasInput = value.trim() !== '';

  const inputClass = [
    'typed-amount-confirm__input',
    hasInput && !isMatch ? 'typed-amount-confirm__input--invalid' : '',
    hasInput && isMatch ? 'typed-amount-confirm__input--valid' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['typed-amount-confirm__field', className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className="typed-amount-confirm__label">
        Type the amount to confirm
      </label>
      <div className="typed-amount-confirm__input-wrap">
        <span className="typed-amount-confirm__prefix" aria-hidden="true">
          $
        </span>
        {/*
         * type="text" + inputMode="decimal" rather than type="number":
         *   - Avoids browser-native numeric validation that would reject partial
         *     input like "5000." mid-typing, conflicting with the exact-match check.
         *   - Suppresses the spin-button UI (up/down arrows) irrelevant for
         *     a confirmation field where the user must type a specific value.
         *   - Makes onChange fire on every keystroke in all environments,
         *     including jsdom-based tests using @testing-library/user-event v14.
         * inputMode="decimal" keeps the correct numeric keyboard on mobile.
         */}
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={formatMoney(amount)}
          aria-describedby={`${hintId} ${helperId}`}
          aria-label="Type the repayment amount to confirm"
          aria-invalid={hasInput && !isMatch}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </div>
      <p id={hintId} className="typed-amount-confirm__hint">
        Type the repayment amount ({formatMoney(amount)}) to enable confirmation.
      </p>
      {hasInput && !isMatch && (
        <p id={helperId} className="typed-amount-confirm__helper" role="status">
          Amount does not match. Type {formatMoney(amount)} exactly.
        </p>
      )}
      {isMatch && (
        <p id={helperId} className="typed-amount-confirm__helper" role="status">
          Amount confirmed.
        </p>
      )}
      {!hasInput && (
        <p id={helperId} className="typed-amount-confirm__helper">
          Type the amount above to enable confirmation.
        </p>
      )}
    </div>
  );
}

export interface TypedAmountConfirmProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Exact amount the user must type to confirm. */
  amount: number;
  /** Called when the user confirms with a matching amount. */
  onConfirm: () => void;
  /** Called when the user cancels or presses Escape. */
  onCancel: () => void;
  /** Ref to the element that opened the modal; focus returns here on close. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Optional dialog title. */
  title?: string;
  /** Optional explanatory copy under the title. */
  description?: string;
  /** Primary action label. */
  confirmLabel?: string;
  /** When true, disables confirm and shows pending state. */
  pending?: boolean;
}

/**
 * Modal that requires the user to type an exact repayment amount before confirming.
 *
 * Used for large repayments (see `requiresRepayConfirmation` / `VITE_REPAY_CONFIRM_THRESHOLD`).
 * Composes focus trap, scroll lock, and inert backdrop for WCAG 2.1 AA compliance.
 */
export function TypedAmountConfirm({
  isOpen,
  amount,
  onConfirm,
  onCancel,
  triggerRef,
  title = 'Confirm large repayment',
  description = 'This repayment exceeds the safety threshold. Type the exact amount to proceed.',
  confirmLabel = 'Confirm Repayment',
  pending = false,
}: TypedAmountConfirmProps) {
  const titleId = useId();
  const [confirmValue, setConfirmValue] = useState('');

  const modalRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: pending ? undefined : onCancel,
  });

  useBodyScrollLock(isOpen);
  useInertBackdrop(isOpen, modalRef);

  useEffect(() => {
    if (isOpen) {
      setConfirmValue('');
    }
  }, [isOpen, amount]);

  if (!isOpen) return null;

  const isMatch = isTypedAmountMatch(confirmValue, amount);
  const isConfirmDisabled = !isMatch || pending;

  return (
    <div
      className="typed-amount-confirm-overlay"
      onClick={pending ? undefined : onCancel}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="typed-amount-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="typed-amount-confirm-dialog__header">
          <div>
            <h2 id={titleId} className="typed-amount-confirm-dialog__title">
              {title}
            </h2>
            <p className="typed-amount-confirm-dialog__subtitle">{description}</p>
          </div>
          {!pending && (
            <button
              type="button"
              className="typed-amount-confirm-dialog__close"
              onClick={onCancel}
              aria-label="Close confirmation dialog"
            >
              ×
            </button>
          )}
        </div>

        <div className="typed-amount-confirm-dialog__body">
          <div className="typed-amount-confirm-dialog__amount">
            <p className="typed-amount-confirm-dialog__amount-label">Repayment amount</p>
            <p className="typed-amount-confirm-dialog__amount-value">{formatMoney(amount)}</p>
          </div>

          <TypedAmountConfirmField
            amount={amount}
            value={confirmValue}
            onChange={setConfirmValue}
            idPrefix="typed-amount-confirm-modal"
          />

          <div className="typed-amount-confirm-dialog__actions">
            <button
              type="button"
              className="typed-amount-confirm-dialog__btn typed-amount-confirm-dialog__btn--secondary"
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </button>
            <PendingButton
              type="button"
              pending={pending}
              pendingLabel="Processing..."
              disabled={isConfirmDisabled}
              aria-disabled={isConfirmDisabled || undefined}
              className="typed-amount-confirm-dialog__btn typed-amount-confirm-dialog__btn--primary"
              onClick={onConfirm}
            >
              {confirmLabel}
            </PendingButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Convenience helper mirroring `requiresRepayConfirmation` for component consumers. */
export function shouldRequireTypedAmountConfirm(amount: number): boolean {
  return requiresRepayConfirmation(amount);
}
