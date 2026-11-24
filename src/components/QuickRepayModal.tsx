import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { getRepayAmountValidation, requiresRepayConfirmation } from '../utils/amountValidation';
import {
  computeMonthlyAccruedInterest,
  roundToCents,
} from '../utils/currency';
import { allocateRepayment } from '../lib/repay-allocation';
import { offlineMutation } from '../utils/offline';
import { submitRepayment } from '../services/repayService';
import {
  createSubmissionAttempt,
  hasSucceeded,
  recordServerResponse,
  recordSubmissionAttempt,
  type SubmissionAttempt,
} from '../utils/idempotency';
import { Skeleton } from './Skeleton';
import './QuickRepayModal.css';
import { ConnectWalletPrompt } from './ConnectWalletPrompt';
import type { RepayableBalanceResult } from '../lib/repayable-balance';
import { SETTLEMENT_ASSET } from '../lib/repayable-balance';
import {
  TypedAmountConfirmField,
  isTypedAmountMatch,
} from './TypedAmountConfirm';

interface RepaymentCreditLine {
  id: string;
  name: string;
  limit: number;
  utilized: number;
  apr: number;
  nextPaymentAmount?: number;
}

interface QuickRepayModalProps {
  creditLine: RepaymentCreditLine;
  walletBalance: number | null;
  balanceStatus: RepayableBalanceResult['status'];
  walletConnected: boolean;
  /** Public key of the connected wallet; required to record the repayment. */
  walletPublicKey?: string | null;
  initialAmount?: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
  /** Refreshes credit data after a successful submission. */
  refetch?: () => Promise<unknown>;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const COLOR = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  success: '#3fb950',
  warning: '#d29922',
  danger: '#f85149',
};

const btnBase: React.CSSProperties = {
  border: `1px solid ${COLOR.border}`,
  borderRadius: 6,
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
  fontWeight: 500,
  cursor: 'pointer',
  background: COLOR.surface,
  color: COLOR.text,
  transition: 'all 0.2s ease',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '0.5rem',
};

const btn = {
  ghost: {
    ...btnBase,
    background: 'transparent',
    color: COLOR.muted,
    borderColor: 'transparent',
  } as React.CSSProperties,
  primary: {
    ...btnBase,
    background: COLOR.accent,
    color: COLOR.bg,
    border: 'none',
    fontWeight: 600,
  } as React.CSSProperties,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);

export function QuickRepayModal({
  creditLine,
  walletBalance,
  balanceStatus,
  walletConnected,
  walletPublicKey,
  initialAmount,
  onClose,
  onSuccess,
  refetch,
  triggerRef,
}: QuickRepayModalProps) {
  const [amountStr, setAmountStr] = useState(initialAmount || '');
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [step, setStep] = useState<'confirm' | 'pending' | 'success' | 'error'>('confirm');
  const [errorMessage, setErrorMessage] = useState('');
  const inFlightRef = useRef(false);
  const submissionRef = useRef<SubmissionAttempt | null>(null);
  const transactionIdRef = useRef<string | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Manage focus across step states to prevent focus dropping to body
    if (step !== 'confirm') {
      requestAnimationFrame(() => {
        modalContainerRef.current?.focus();
      });
    }
  }, [step]);

  const accruedInterest = computeMonthlyAccruedInterest(
    creditLine.utilized,
    creditLine.apr,
  );
  const totalDue = roundToCents(creditLine.utilized + accruedInterest);
  const hasRepayableBalance =
    walletConnected && balanceStatus === 'ok' && walletBalance !== null;
  const validation = getRepayAmountValidation(amountStr, totalDue, walletBalance ?? 0);
  const amount = validation.amount;
  const isInvalid = !validation.isValid;

  const allocation = allocateRepayment(creditLine, amount, accruedInterest);
  const remainingDebt = allocation.remainingTotal;
  const newPct = creditLine.limit === 0 ? 0 : Math.round((remainingDebt / creditLine.limit) * 100);

  const toneMeta = {
    info: { color: '#58a6ff', bg: 'rgba(88,166,255,0.08)', border: 'rgba(88,166,255,0.25)', icon: <Info size={16} aria-hidden="true" /> },
    success: { color: COLOR.success, bg: 'rgba(63,185,80,0.08)', border: 'rgba(63,185,80,0.25)', icon: <CheckCircle size={16} aria-hidden="true" /> },
    warning: { color: COLOR.warning, bg: 'rgba(210,153,34,0.08)', border: 'rgba(210,153,34,0.25)', icon: <AlertTriangle size={16} aria-hidden="true" /> },
    danger: { color: COLOR.danger, bg: 'rgba(248,81,73,0.08)', border: 'rgba(248,81,73,0.25)', icon: <AlertCircle size={16} aria-hidden="true" /> },
  } as const;
  const activeTone = toneMeta[validation.feedback.severity];

  const needsConfirm = requiresRepayConfirmation(amount);
  const isConfirmDisabled =
    !hasRepayableBalance ||
    isInvalid ||
    (needsConfirm && !isTypedAmountMatch(confirmAmountStr, amount));

  const handleConfirm = async () => {
    if (inFlightRef.current || step === 'pending' || step === 'success') return;

    if (!walletPublicKey) {
      setErrorMessage('Connect a wallet before submitting a repayment.');
      setStep('error');
      return;
    }

    if (!submissionRef.current) {
      const created = createSubmissionAttempt({
        creditLineId: creditLine.id,
        incomingAssetId: 'repay',
        initiatedAtMs: Date.now(),
      });
      submissionRef.current = created;
      // Derive the transaction id from the idempotency key so retries and
      // double clicks resolve to the same persisted record.
      transactionIdRef.current = `TXN-${created.idempotencyKey.slice('idem_'.length)}`;
    }

    const attempt = submissionRef.current;
    if (!attempt) return;

    if (hasSucceeded(attempt)) {
      setStep('success');
      return;
    }

    inFlightRef.current = true;
    setErrorMessage('');
    setStep('pending');
    submissionRef.current = recordSubmissionAttempt(attempt);
    const currentAttempt = submissionRef.current;

    try {
      await offlineMutation({
        fn: () =>
          submitRepayment({
            transactionId: transactionIdRef.current ?? undefined,
            walletPublicKey,
            creditLineId: creditLine.id,
            creditLineName: creditLine.name,
            amount,
            remainingDebt,
            limit: creditLine.limit,
            apr: creditLine.apr,
            nextPaymentAmount: creditLine.nextPaymentAmount,
          }),
        offlineMessage:
          'You are offline. The repayment was not submitted. Reconnect and retry.',
      });
      submissionRef.current = recordServerResponse(currentAttempt, 'success');
      setStep('success');
      if (refetch) {
        void Promise.resolve(refetch()).catch(() => undefined);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The repayment could not be submitted. Please retry.';
      submissionRef.current = recordServerResponse(currentAttempt, 'error', message);
      setErrorMessage(message);
      setStep('error');
    } finally {
      inFlightRef.current = false;
    }
  };

  const handleCloseComplete = () => {
    onSuccess(amount);
  };

  return (
    <Modal
      isOpen
      triggerRef={triggerRef}
      dialogRef={modalContainerRef}
      closeOnEscape={step !== 'pending'}
      closeOnBackdropClick={step !== 'pending'}
      onEscape={step !== 'pending' ? onClose : undefined}
      onBackdropClick={step !== 'pending' ? onClose : undefined}
      ariaLabelledBy="quick-repay-title"
      overlayStyle={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}
      dialogStyle={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'slideUp 0.3s ease' }}
    >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 id="quick-repay-title" style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 600, color: COLOR.text }}>
              {step === 'success'
                ? 'Repayment Successful'
                : step === 'error'
                  ? 'Repayment Failed'
                  : 'Quick Repay'}
            </h2>
            {step !== 'success' && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: COLOR.muted }}>
                {creditLine.name}
              </p>
            )}
          </div>
          {step !== 'pending' && <button className="focus-ring" onClick={onClose} style={{ ...btn.ghost, padding: '0.4rem', borderRadius: 4 }} aria-label="Close modal">✕</button>}
        </div>

        {step === 'confirm' && !walletConnected && (
          <div style={{ padding: '1.5rem' }}>
            <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
          </div>
        )}

        {step === 'confirm' && walletConnected && balanceStatus === 'no_trustline' && (
          <div style={{ padding: '1.5rem' }}>
            <div
              role="alert"
              style={{
                border: `1px solid ${COLOR.danger}`,
                background: 'rgba(248,81,73,0.08)',
                color: COLOR.text,
                borderRadius: 8,
                padding: '1rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                Add a {SETTLEMENT_ASSET.code} trustline to repay
              </p>
              <p style={{ margin: '0.5rem 0 0', color: COLOR.muted }}>
                Add the settlement-asset trustline to your wallet, then refresh your balance.
              </p>
            </div>
          </div>
        )}

        {step === 'confirm' && walletConnected && balanceStatus !== 'no_trustline' && (
          <div style={{ padding: '1.5rem' }}>
            <div
              aria-busy={balanceStatus === 'loading'}
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                color: COLOR.muted,
                fontSize: '0.85rem',
              }}
            >
              <span>{SETTLEMENT_ASSET.code} wallet balance</span>
              {balanceStatus === 'loading' ? (
                <>
                  <span className="sr-only">
                    Loading {SETTLEMENT_ASSET.code} balance
                  </span>
                  <Skeleton width={72} height={16} />
                </>
              ) : (
                <span>{fmt(walletBalance ?? 0)}</span>
              )}
            </div>
            <div style={{ marginBottom: '1.5rem', background: COLOR.bg, padding: '1rem', borderRadius: 8, border: `1px solid ${COLOR.border}` }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: COLOR.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Outstanding debt
              </p>
              <p style={{ margin: 0, fontSize: '2rem', fontWeight: 700, color: COLOR.danger, lineHeight: 1 }}>
                {fmt(totalDue)}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="quick-repay-amount" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: COLOR.text, fontWeight: 500 }}>Repayment amount</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.25rem', color: COLOR.muted }} aria-hidden="true">$</span>
                <input className="focus-ring"
                  id="quick-repay-amount"
                  type="number"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    submissionRef.current = null;
                    transactionIdRef.current = null;
                  }}
                  placeholder="0.00"
                  aria-invalid={isInvalid}
                  style={{
                    width: '100%',
                    background: COLOR.bg,
                    border: `1px solid ${isInvalid ? COLOR.danger : amount > 0 ? COLOR.accent : COLOR.border}`,
                    borderRadius: 8,
                    padding: '0.75rem 1rem 0.75rem 2rem',
                    color: COLOR.text,
                    fontSize: '1.25rem',
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
              <div
                role={isInvalid ? 'alert' : 'status'}
                aria-live="polite"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  marginTop: '0.75rem',
                  border: `1px solid ${activeTone.border}`,
                  background: activeTone.bg,
                  color: activeTone.color,
                  borderRadius: 8,
                  padding: '0.75rem',
                }}
              >
                <span style={{ display: 'inline-flex', marginTop: 1 }}>{activeTone.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600 }}>{validation.feedback.title}</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', lineHeight: 1.5 }}>{validation.feedback.message}</p>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem', background: COLOR.bg, padding: '1rem', borderRadius: 8, border: `1px solid ${COLOR.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', color: COLOR.muted }}>Remaining debt</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: remainingDebt === 0 ? COLOR.success : COLOR.text }}>
                  {fmt(remainingDebt)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: COLOR.muted }}>Utilization after</span>
                <span style={{ fontSize: '0.8rem', color: amount > 0 ? COLOR.success : COLOR.text }}>
                  {newPct}%
                </span>
              </div>
            </div>

            {needsConfirm && (
              <TypedAmountConfirmField
                amount={amount}
                value={confirmAmountStr}
                onChange={setConfirmAmountStr}
                idPrefix="quick-repay-confirm"
              />
            )}

            <button className="focus-ring"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              style={{
                ...btn.primary,
                width: '100%',
                opacity: isConfirmDisabled ? 0.5 : 1,
                cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              Confirm Repayment
            </button>
          </div>
        )}

        {step === 'pending' && (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: `3px solid ${COLOR.border}`,
                borderTopColor: COLOR.accent,
                borderRadius: '50%',
                margin: '0 auto 1.5rem',
                animation: 'spin 1s linear infinite',
              }}
            />
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: COLOR.text }}>
              Processing repayment
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: COLOR.muted }}>
              Confirming transaction on network...
            </p>
          </div>
        )}

        {step === 'error' && (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(248,81,73,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <AlertCircle size={32} color={COLOR.danger} aria-hidden="true" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: COLOR.text }}>
              Repayment failed
            </h3>
            <p role="alert" style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: COLOR.muted }}>
              {errorMessage}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="focus-ring"
                onClick={() => { void handleConfirm(); }}
                style={{ ...btn.primary, flex: 1 }}
              >
                Retry
              </button>
              <button
                className="focus-ring"
                onClick={() => {
                  setErrorMessage('');
                  setStep('confirm');
                }}
                style={{ ...btn.ghost, flex: 1, border: `1px solid ${COLOR.border}` }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ width: 64, height: 64, background: COLOR.success, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', animation: 'scaleIn 0.4s ease' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', color: COLOR.text }}>
              You repaid {fmt(amount)}!
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: COLOR.muted }}>
              Your transaction was successful.
            </p>
            <button className="focus-ring" onClick={handleCloseComplete} style={{ ...btn.primary, width: '100%' }}>
              Back to Dashboard
            </button>
          </div>
        )}
    </Modal>
  );
}
