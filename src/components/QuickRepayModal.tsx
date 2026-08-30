import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { formatMoney, getRepayAmountValidation, requiresRepayConfirmation } from '../utils/amountValidation';
import { PendingButton } from './PendingButton';
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
}

interface QuickRepayModalProps {
  creditLine: RepaymentCreditLine;
  walletBalance: number;
  initialAmount?: string;
  onClose: () => void;
  onSuccess: (amount: number) => void;
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
  initialAmount,
  onClose,
  onSuccess,
  triggerRef,
}: QuickRepayModalProps) {
  const [amountStr, setAmountStr] = useState(initialAmount || '');
  const [confirmAmountStr, setConfirmAmountStr] = useState('');
  const [step, setStep] = useState<'confirm' | 'pending' | 'success'>('confirm');
  
  const modalRef = useFocusTrap({
    isActive: true,
    triggerRef,
    onEscape: step !== 'pending' ? onClose : undefined,
  });

  useEffect(() => {
    if (step === 'confirm') {
      document.body.style.overflow = 'hidden';
    } else if (step === 'success') {
      document.body.style.overflow = '';
    }
    // Manage focus across step states to prevent focus dropping to body
    if (step !== 'confirm') {
      requestAnimationFrame(() => {
        modalRef.current?.focus();
      });
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [step, modalRef]);

  const totalDue = creditLine.utilized;
  const validation = getRepayAmountValidation(amountStr, totalDue, walletBalance);
  const amount = validation.amount;
  const isInvalid = !validation.isValid;
  
  const remainingDebt = validation.remainingDebt;
  const oldPct = creditLine.limit === 0 ? 0 : Math.round((creditLine.utilized / creditLine.limit) * 100);
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
    isInvalid || (needsConfirm && !isTypedAmountMatch(confirmAmountStr, amount));

  const handleConfirm = () => {
    setStep('pending');
    setTimeout(() => {
      setStep('success');
    }, 2000);
  };

  const handleCloseComplete = () => {
    onSuccess(amount);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', animation: 'fadeIn 0.2s ease' }}
      onClick={step !== 'pending' ? onClose : undefined} role="presentation">
      
      <div 
        ref={modalRef}
        style={{ background: COLOR.surface, border: `1px solid ${COLOR.border}`, borderRadius: 12, width: '100%', maxWidth: 400, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', overflow: 'hidden', animation: 'slideUp 0.3s ease' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-repay-title"
        tabIndex={-1}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${COLOR.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 id="quick-repay-title" style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 600, color: COLOR.text }}>
              {step === 'success' ? 'Repayment Successful' : 'Quick Repay'}
            </h2>
            {step !== 'success' && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: COLOR.muted }}>
                {creditLine.name}
              </p>
            )}
          </div>
          {step !== 'pending' && <button className="focus-ring" onClick={onClose} style={{ ...btn.ghost, padding: '0.4rem', borderRadius: 4 }} aria-label="Close modal">✕</button>}
        </div>

        {step === 'confirm' && (
          <div style={{ padding: '1.5rem' }}>
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
                  onChange={(e) => setAmountStr(e.target.value)}
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
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes scaleIn { 0% { transform: scale(0); } 60% { transform: scale(1.1); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
