import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  DollarSign,
  Info,
  ShieldCheck,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  formatMoney,
  requiresRepayConfirmation,
} from '../utils/amountValidation';
import {
  computeFullPayoffAmount,
  computeMonthlyAccruedInterest,
} from '../utils/currency';
import {
  computeDefaultMonthlyPayment,
  computePayoffProjection,
  formatMonths,
  formatPayoffDate,
} from '../utils/payoffProjection';
import { PendingButton } from './PendingButton';
import {
  TypedAmountConfirmField,
  isTypedAmountMatch,
} from './TypedAmountConfirm';
import './RepayPreviewModal.css';

export interface RepaymentCreditLine {
  id: string;
  name: string;
  limit: number;
  utilized: number;
  apr: number;
  nextPaymentAmount?: number;
}

export interface RepayPreviewModalProps {
  /** Controls whether the modal dialog is visible */
  isOpen: boolean;
  /** Credit line model against which repayment will be made */
  creditLine: RepaymentCreditLine;
  /** Current user wallet balance in USD */
  walletBalance: number;
  /** Proposed repayment amount in USD */
  repayAmount: number;
  /** Callback fired when user closes or cancels the modal */
  onClose: () => void;
  /** Callback fired when user confirms the repayment submit */
  onConfirm: (amount: number) => void | Promise<void>;
  /** Trigger element reference to return keyboard focus upon close */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** Custom title for the modal header */
  title?: string;
  /** Custom submit button label */
  confirmLabel?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);

/**
 * RepayPreviewModal
 *
 * Renders a full preview of repayment consequences before submission.
 * Displays breakdown of interest vs principal allocation, debt reduction,
 * credit availability restoration, wallet balance impact, interest saved,
 * and payoff timeline reduction.
 *
 * WCAG 2.1 AA Compliant: Focus trapped (`useFocusTrap`), keyboard accessible (`Esc`),
 * contrast checked, and screen-reader polite announcements.
 */
export function RepayPreviewModal({
  isOpen,
  creditLine,
  walletBalance,
  repayAmount,
  onClose,
  onConfirm,
  triggerRef,
  title = 'Preview Repayment Consequences',
  confirmLabel = 'Confirm & Repay',
}: RepayPreviewModalProps) {
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const modalRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    onEscape: !isSubmitting ? onClose : undefined,
  });

  useEffect(() => {
    if (isOpen) {
      setConfirmAmountStr('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const principalBalance = creditLine.utilized;
  const accruedInterest = computeMonthlyAccruedInterest(
    principalBalance,
    creditLine.apr,
  );
  const fullPayoff = computeFullPayoffAmount(principalBalance, creditLine.apr);
  const totalDue = fullPayoff;

  const isFullPayoff = repayAmount >= totalDue || (totalDue > 0 && Math.abs(repayAmount - totalDue) < 0.01);
  const interestPortion = Math.min(repayAmount, accruedInterest);
  const principalPortion = Math.max(0, repayAmount - interestPortion);

  const remainingDebt = isFullPayoff ? 0 : Math.max(0, totalDue - repayAmount);
  const currentAvailable = Math.max(0, creditLine.limit - principalBalance);
  const newAvailable = isFullPayoff
    ? creditLine.limit
    : Math.min(creditLine.limit, currentAvailable + principalPortion);

  const oldPct =
    creditLine.limit === 0
      ? 0
      : Math.round((principalBalance / creditLine.limit) * 100);
  const newPct =
    creditLine.limit === 0 || isFullPayoff
      ? 0
      : Math.round((remainingDebt / creditLine.limit) * 100);

  const walletBalanceAfter = Math.max(0, walletBalance - repayAmount);
  const isLowWalletReserve = walletBalanceAfter < 500 || walletBalanceAfter < walletBalance * 0.1;

  const monthlyPayment = computeDefaultMonthlyPayment(
    principalBalance,
    creditLine.apr,
    creditLine.nextPaymentAmount,
  );

  const projection = computePayoffProjection(
    principalBalance,
    creditLine.apr,
    monthlyPayment,
    repayAmount,
    creditLine.limit,
  );

  const needsConfirm = requiresRepayConfirmation(repayAmount);
  const isConfirmMatch = needsConfirm
    ? isTypedAmountMatch(confirmAmountStr, repayAmount)
    : true;
  const isSubmitDisabled = isSubmitting || (needsConfirm && !isConfirmMatch);

  const handleConfirmSubmit = async () => {
    if (isSubmitDisabled) return;
    try {
      setIsSubmitting(true);
      await onConfirm(repayAmount);
    } catch {
      setIsSubmitting(false);
    }
  };

  const modalTitleId = 'repay-preview-modal-title';
  const modalDescId = 'repay-preview-modal-desc';

  return (
    <div
      className="repay-preview-overlay"
      onClick={!isSubmitting ? onClose : undefined}
      role="presentation"
      data-testid="repay-preview-modal-backdrop"
    >
      <div
        ref={modalRef}
        className="repay-preview-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        aria-describedby={modalDescId}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="repay-preview-header">
          <div>
            <h2 id={modalTitleId} className="repay-preview-title">
              {title}
            </h2>
            <p className="repay-preview-subtitle">
              {creditLine.name} · {creditLine.id}
            </p>
          </div>
          {!isSubmitting && (
            <button
              type="button"
              className="repay-preview-close-btn"
              onClick={onClose}
              aria-label="Close preview modal"
              data-testid="repay-preview-close"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="repay-preview-body" id={modalDescId}>
          {/* Hero Amount & Badge */}
          <div className="repay-preview-hero">
            <p className="repay-preview-hero-label">Proposed Repayment</p>
            <p className="repay-preview-hero-amount">
              <span className="tabular-nums">{fmt(repayAmount)}</span>
            </p>
            <span
              className={`repay-preview-badge ${
                isFullPayoff
                  ? 'repay-preview-badge--full'
                  : 'repay-preview-badge--partial'
              }`}
              role="status"
            >
              {isFullPayoff ? (
                <>
                  <CheckCircle size={14} aria-hidden="true" /> Full Payoff
                </>
              ) : (
                <>
                  <ShieldCheck size={14} aria-hidden="true" /> Partial Repayment
                </>
              )}
            </span>
          </div>

          {/* Impact Metrics Grid */}
          <div className="repay-preview-grid">
            {/* Remaining Debt */}
            <div className="repay-preview-stat-box">
              <p className="repay-preview-stat-label">Remaining Debt</p>
              <p className="repay-preview-stat-value">
                <span className="tabular-nums">{fmt(remainingDebt)}</span>
              </p>
              <p className="repay-preview-stat-sub">
                <TrendingDown size={12} aria-hidden="true" />
                Was <span className="tabular-nums">{fmt(totalDue)}</span>
              </p>
            </div>

            {/* Restored Available Credit */}
            <div className="repay-preview-stat-box">
              <p className="repay-preview-stat-label">Available Credit Limit</p>
              <p className="repay-preview-stat-value">
                <span className="tabular-nums">{fmt(newAvailable)}</span>
              </p>
              <p className="repay-preview-stat-sub">
                +<span className="tabular-nums">{fmt(newAvailable - currentAvailable)}</span> restored
              </p>
            </div>
          </div>

          {/* Payment Breakdown Section */}
          <div className="repay-preview-section">
            <h3 className="repay-preview-section-title">
              <DollarSign size={14} aria-hidden="true" /> Repayment Allocation
            </h3>
            <div className="repay-preview-row">
              <span className="repay-preview-row-label">Principal Reduction</span>
              <span className="repay-preview-row-value">
                <span className="tabular-nums">{fmt(principalPortion)}</span>
              </span>
            </div>
            {accruedInterest > 0 && (
              <div className="repay-preview-row">
                <span className="repay-preview-row-label">Accrued Interest Paid</span>
                <span className="repay-preview-row-value">
                  <span className="tabular-nums">{fmt(interestPortion)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Credit Utilization Bar */}
          <div className="repay-preview-section">
            <div className="repay-preview-row">
              <span className="repay-preview-section-title" style={{ margin: 0 }}>
                Credit Utilization Change
              </span>
              <span className="repay-preview-row-value">
                <span className="tabular-nums">{newPct}%</span>{' '}
                <span
                  style={{
                    textDecoration: 'line-through',
                    color: 'var(--muted)',
                    marginLeft: 4,
                    fontSize: '0.8rem',
                  }}
                >
                  <span className="tabular-nums">{oldPct}%</span>
                </span>
              </span>
            </div>
            <div
              className="repay-preview-util-track"
              role="progressbar"
              aria-valuenow={newPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Utilization reduces from ${oldPct}% to ${newPct}%`}
            >
              <div
                className="repay-preview-util-before"
                style={{ width: `${oldPct}%` }}
              />
              <div
                className="repay-preview-util-after"
                style={{ width: `${newPct}%` }}
              />
            </div>
          </div>

          {/* Payoff Projection Impact */}
          <div className="repay-preview-section">
            <h3 className="repay-preview-section-title">
              <Clock size={14} aria-hidden="true" /> Timeline & Interest Impact
            </h3>
            <div className="repay-preview-row">
              <span className="repay-preview-row-label">Months Saved</span>
              <span className="repay-preview-row-value" style={{ color: 'var(--success)' }}>
                {isFullPayoff
                  ? 'Paid off now'
                  : projection.monthsSaved > 0
                  ? `${projection.monthsSaved} mo sooner`
                  : 'No change'}
              </span>
            </div>
            {projection.interestSaved > 0 && (
              <div className="repay-preview-row">
                <span className="repay-preview-row-label">Est. Interest Saved</span>
                <span className="repay-preview-row-value" style={{ color: 'var(--success)' }}>
                  <span className="tabular-nums">{fmt(projection.interestSaved)}</span>
                </span>
              </div>
            )}
            <div className="repay-preview-row">
              <span className="repay-preview-row-label">Target Debt Free Date</span>
              <span className="repay-preview-row-value">
                {formatPayoffDate(projection.newMonths, isFullPayoff)}
              </span>
            </div>
          </div>

          {/* Wallet Balance Impact */}
          <div className="repay-preview-section">
            <h3 className="repay-preview-section-title">
              <Wallet size={14} aria-hidden="true" /> Wallet Balance Impact
            </h3>
            <div className="repay-preview-row">
              <span className="repay-preview-row-label">Current Wallet Balance</span>
              <span className="repay-preview-row-value">
                <span className="tabular-nums">{fmt(walletBalance)}</span>
              </span>
            </div>
            <div className="repay-preview-row">
              <span className="repay-preview-row-label">Balance After Repayment</span>
              <span className="repay-preview-row-value">
                <span className="tabular-nums">{fmt(walletBalanceAfter)}</span>
              </span>
            </div>
          </div>

          {/* Low Wallet Reserve Warning Callout */}
          {isLowWalletReserve && (
            <div className="repay-preview-alert repay-preview-alert--warning" role="alert">
              <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
              <div>
                <strong>Low Wallet Reserve Warning:</strong> Repaying {fmt(repayAmount)} will leave you with {fmt(walletBalanceAfter)} in your wallet. Ensure you maintain sufficient liquid reserves for network gas and emergency expenses.
              </div>
            </div>
          )}

          {/* Typed Amount Confirmation Guard for large repayments */}
          {needsConfirm && (
            <div className="repay-preview-section" style={{ borderColor: 'var(--accent)' }}>
              <TypedAmountConfirmField
                amount={repayAmount}
                value={confirmAmountStr}
                onChange={setConfirmAmountStr}
                idPrefix="repay-preview-confirm"
              />
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="repay-preview-footer">
          <button
            type="button"
            className="repay-preview-btn repay-preview-btn--back"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="repay-preview-cancel"
          >
            Edit Amount
          </button>
          <PendingButton
            onClick={handleConfirmSubmit}
            pending={isSubmitting}
            pendingLabel="Submitting..."
            disabled={isSubmitDisabled}
            className="repay-preview-btn repay-preview-btn--confirm"
            data-testid="repay-preview-confirm"
          >
            {confirmLabel}
          </PendingButton>
        </div>
      </div>
    </div>
  );
}
