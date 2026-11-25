import { useId, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import type { CreditLine } from '../types/creditLine';
import { fmt } from '../utils/tokens';
import './LimitIncreaseModal.css';

export type LimitIncreaseReason =
  | 'Business expansion'
  | 'Working capital'
  | 'Equipment purchase'
  | 'Other';

export interface LimitIncreaseSubmission {
  amount: number;
  reason: LimitIncreaseReason;
}

interface LimitIncreaseModalProps {
  line: CreditLine;
  maxRequestable: number;
  triggerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onSubmit: (submission: LimitIncreaseSubmission) => void;
}

const REASONS: LimitIncreaseReason[] = [
  'Business expansion',
  'Working capital',
  'Equipment purchase',
  'Other',
];

export function LimitIncreaseModal({
  line,
  maxRequestable,
  triggerRef,
  onClose,
  onSubmit,
}: LimitIncreaseModalProps) {
  const titleId = useId();
  const introId = useId();
  const amountId = useId();
  const reasonId = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState<LimitIncreaseReason | ''>('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const amount = Number(amountText);
  const validAmount =
    amountText.trim() !== '' &&
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= maxRequestable;
  const projectedLimit = validAmount ? line.limit + amount : line.limit;
  const projectedUtilization =
    projectedLimit > 0 ? (line.utilized / projectedLimit) * 100 : 0;

  const summary = useMemo(
    () => [
      { label: 'Current limit', value: fmt(line.limit) },
      { label: 'Increase requested', value: validAmount ? fmt(amount) : '—' },
      { label: 'New limit', value: validAmount ? fmt(projectedLimit) : '—' },
      {
        label: 'Projected utilization',
        value: validAmount ? `${projectedUtilization.toFixed(1)}%` : '—',
      },
    ],
    [amount, line.limit, projectedLimit, projectedUtilization, validAmount],
  );

  const handleSubmit = () => {
    if (!validAmount) {
      setError(
        amountText.trim() === '' ||
          !Number.isFinite(amount) ||
          amount <= 0
          ? 'Enter an amount greater than zero.'
          : `Enter an amount no greater than ${fmt(maxRequestable)}.`,
      );
      return;
    }
    if (!reason) {
      setError('Select a reason for your request.');
      return;
    }

    try {
      onSubmit({ amount, reason });
      setError('');
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit your request. Please try again.',
      );
    }
  };

  return (
    <Modal
      isOpen
      role="dialog"
      triggerRef={triggerRef}
      initialFocusRef={submitted ? undefined : amountRef}
      onEscape={onClose}
      onBackdropClick={onClose}
      ariaLabelledBy={titleId}
      ariaDescribedBy={submitted ? undefined : introId}
      overlayClassName="limit-increase-modal__portal"
      dialogClassName="limit-increase-modal"
      backdropClassName="limit-increase-modal__backdrop"
    >
      {submitted ? (
        <div role="status" aria-live="polite">
          <h2 id={titleId}>Request submitted</h2>
          <p>Your limit increase request for {line.name} has been saved.</p>
          <button type="button" className="limit-increase-modal__primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <>
          <h2 id={titleId}>Request a limit increase</h2>
          <p id={introId} className="limit-increase-modal__intro">
            Request an increase for {line.name}. The maximum request is {fmt(maxRequestable)}.
          </p>

          <div className="limit-increase-modal__summary" aria-label="Limit summary">
            {summary.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="limit-increase-modal__field">
            <label htmlFor={amountId}>Requested amount</label>
            <input
              ref={amountRef}
              id={amountId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              aria-invalid={Boolean(error && !validAmount)}
              aria-describedby={error ? `${amountId}-error` : undefined}
              onChange={(event) => {
                setAmountText(event.target.value);
                setError('');
              }}
            />
          </div>

          <div className="limit-increase-modal__field">
            <label htmlFor={reasonId}>Reason</label>
            <select
              id={reasonId}
              value={reason}
              aria-describedby={error && !reason ? `${reasonId}-error` : undefined}
              onChange={(event) => {
                setReason(event.target.value as LimitIncreaseReason | '');
                setError('');
              }}
            >
              <option value="">Select a reason</option>
              {REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p
              className="limit-increase-modal__error"
              id={!validAmount ? `${amountId}-error` : `${reasonId}-error`}
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="limit-increase-modal__actions">
            <button type="button" className="limit-increase-modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="limit-increase-modal__primary" onClick={handleSubmit}>
              Submit request
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
