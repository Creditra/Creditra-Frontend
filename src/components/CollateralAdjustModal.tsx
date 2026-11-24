/**
 * CollateralAdjustModal
 *
 * Allows a borrower to top up (add) or withdraw pledged collateral against a credit line.
 * Provides live LTV preview (before vs. after), maximum safe withdrawable calculation,
 * and blocks any withdrawal that would breach the safe LTV ceiling.
 */
import React, { useState, useMemo } from 'react';
import { AlertCircle, ArrowRight, CheckCircle, Plus, Minus, X, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import type { CreditLine } from '../types/creditLine';
import type { CollateralAsset } from '../types/collateral';
import {
  categoryIcon,
  computeCollateralAdjustment,
  computeMaxWithdrawable,
  findAssetByName,
  fmtLtv,
  fmtLtvDelta,
  type CollateralAdjustMode,
} from '../utils/collateral';
import { adjustCollateral } from '../services/creditLine';
import { fmt, COLOR } from '../utils/tokens';
import './CollateralAdjustModal.css';

export interface SubmitCollateralAdjustPayload {
  lineId: string;
  mode: CollateralAdjustMode;
  amount: number;
}

export interface CollateralAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: { mode: CollateralAdjustMode; amount: number; newCollateralValue: number }) => void;
  creditLine: CreditLine;
  currentAsset?: CollateralAsset;
  triggerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Optional custom submission handler for testing or production overrides.
   */
  submitAdjustment?: (payload: SubmitCollateralAdjustPayload) => Promise<void>;
  /**
   * Simulated delay in ms for the default submit handler.
   */
  _delayMs?: number;
}

type ModalStep = 'input' | 'pending' | 'success' | 'error';

export function CollateralAdjustModal({
  isOpen,
  onClose,
  onSuccess,
  creditLine,
  currentAsset,
  triggerRef,
  submitAdjustment,
  _delayMs = 200,
}: CollateralAdjustModalProps) {
  const [mode, setMode] = useState<CollateralAdjustMode>('add');
  const [amountStr, setAmountStr] = useState<string>('');
  const [step, setStep] = useState<ModalStep>('input');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Resolve pledged asset from prop or mock catalogue or fallback
  const asset: CollateralAsset = useMemo(() => {
    if (currentAsset) return currentAsset;
    const found = findAssetByName(creditLine.collateral);
    if (found) return found;
    return {
      id: `asset-${creditLine.id}`,
      name: creditLine.collateral || 'Pledged Collateral',
      value: Math.max(creditLine.utilized * 1.5, 100_000),
      maxLtvRatio: 0.75,
      category: 'crypto',
    };
  }, [currentAsset, creditLine]);

  const parsedAmount = parseFloat(amountStr) || 0;

  // Compute live adjustment details
  const adjustment = useMemo(() => {
    return computeCollateralAdjustment(asset, creditLine.utilized, mode, parsedAmount);
  }, [asset, creditLine.utilized, mode, parsedAmount]);

  const maxWithdrawable = adjustment.maxWithdrawable;
  const ltvDelta = fmtLtvDelta(adjustment.currentSnapshot, adjustment.adjustedSnapshot);

  const handleMaxClick = () => {
    setAmountStr(maxWithdrawable > 0 ? String(maxWithdrawable) : '0');
  };

  const handleModeChange = (newMode: CollateralAdjustMode) => {
    setMode(newMode);
    setAmountStr('');
    setErrorMessage('');
  };

  const handleSubmit = async () => {
    if (!adjustment.isValid || step === 'pending') return;

    setStep('pending');
    setErrorMessage('');

    try {
      if (submitAdjustment) {
        await submitAdjustment({
          lineId: creditLine.id,
          mode,
          amount: parsedAmount,
        });
      } else {
        await adjustCollateral({
          lineId: creditLine.id,
          mode,
          amount: parsedAmount,
          newCollateralValue: adjustment.adjustedCollateralValue,
        });
        if (_delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, _delayMs));
        }
      }
      setStep('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to adjust collateral.');
      setStep('error');
    }
  };

  const handleSuccessClose = () => {
    if (onSuccess) {
      onSuccess({
        mode,
        amount: parsedAmount,
        newCollateralValue: adjustment.adjustedCollateralValue,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={step !== 'pending' ? onClose : undefined}
      onEscape={step !== 'pending' ? onClose : undefined}
      triggerRef={triggerRef}
      ariaLabelledBy="collateral-adjust-title"
      dialogClassName="cam-dialog"
    >
      <div className="cam-header">
        <div>
          <h2 id="collateral-adjust-title" className="cam-title">
            {step === 'success'
              ? 'Collateral Adjusted'
              : step === 'error'
                ? 'Adjustment Failed'
                : 'Adjust Collateral'}
          </h2>
          <p className="cam-subtitle">
            {creditLine.name} ({creditLine.id})
          </p>
        </div>
        {step !== 'pending' && (
          <button
            type="button"
            className="cam-close-btn focus-ring"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {step === 'input' && (
        <div className="cam-body">
          {/* Mode Toggle */}
          <div className="cam-tabs" role="tablist" aria-label="Adjustment action">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'add'}
              className={`cam-tab focus-ring ${mode === 'add' ? 'cam-tab--active' : ''}`}
              onClick={() => handleModeChange('add')}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Collateral
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'withdraw'}
              className={`cam-tab focus-ring ${mode === 'withdraw' ? 'cam-tab--active' : ''}`}
              onClick={() => handleModeChange('withdraw')}
            >
              <Minus className="w-4 h-4" aria-hidden="true" />
              Withdraw Collateral
            </button>
          </div>

          {/* Current Position Overview */}
          <div className="cam-info-card">
            <div className="cam-info-item">
              <span className="cam-info-label">Pledged Asset</span>
              <span className="cam-info-value">
                {categoryIcon(asset.category)} {asset.name}
              </span>
            </div>
            <div className="cam-info-item">
              <span className="cam-info-label">Outstanding Loan</span>
              <span className="cam-info-value">{fmt(creditLine.utilized)}</span>
            </div>
            <div className="cam-info-item">
              <span className="cam-info-label">Collateral Value</span>
              <span className="cam-info-value">{fmt(asset.value)}</span>
            </div>
            <div className="cam-info-item">
              <span className="cam-info-label">Current LTV / Max</span>
              <span className="cam-info-value">
                {fmtLtv(adjustment.currentSnapshot.ltvRatio)} / {fmtLtv(asset.maxLtvRatio)}
              </span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="cam-input-section">
            <div className="cam-input-header">
              <label htmlFor="collateral-adjust-amount-input" className="cam-input-label">
                {mode === 'add' ? 'Amount to add' : 'Amount to withdraw'}
              </label>
              {mode === 'withdraw' && (
                <button
                  type="button"
                  className="cam-max-btn focus-ring"
                  onClick={handleMaxClick}
                  aria-label={`Max safe: ${fmt(maxWithdrawable)}`}
                >
                  Max Safe: {fmt(maxWithdrawable)}
                </button>
              )}
            </div>
            <div className="cam-input-wrapper">
              <span className="cam-input-prefix" aria-hidden="true">
                $
              </span>
              <input
                id="collateral-adjust-amount-input"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="cam-amount-input focus-ring"
                aria-describedby={
                  adjustment.errorMessage ? 'collateral-adjust-error' : 'collateral-adjust-helper'
                }
                autoFocus
              />
            </div>
            {mode === 'withdraw' ? (
              <span id="collateral-adjust-helper" className="cam-helper-text">
                Maximum withdrawable without exceeding {fmtLtv(asset.maxLtvRatio)} LTV is{' '}
                <strong>{fmt(maxWithdrawable)}</strong>.
              </span>
            ) : (
              <span id="collateral-adjust-helper" className="cam-helper-text">
                Adding collateral increases your collateral cushion and lowers your LTV ratio.
              </span>
            )}
          </div>

          {/* Before & After LTV Preview */}
          <div className="cam-preview-card">
            <div className="cam-preview-title">LTV Impact Preview</div>
            <div className="cam-preview-grid">
              <div className="cam-preview-box">
                <p className="cam-preview-box-label">Current LTV</p>
                <p className="cam-preview-box-val">{fmtLtv(adjustment.currentSnapshot.ltvRatio)}</p>
              </div>
              <div className="cam-preview-arrow">
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </div>
              <div
                className="cam-preview-box"
                style={{
                  borderColor: adjustment.isBreachingMaxLtv
                    ? COLOR.danger
                    : parsedAmount > 0
                      ? COLOR.success
                      : undefined,
                }}
              >
                <p className="cam-preview-box-label">Projected LTV</p>
                <p
                  className="cam-preview-box-val"
                  style={{
                    color: adjustment.isBreachingMaxLtv
                      ? COLOR.danger
                      : parsedAmount > 0
                        ? COLOR.success
                        : COLOR.text,
                  }}
                >
                  {fmtLtv(adjustment.adjustedSnapshot.ltvRatio)}
                </p>
              </div>
            </div>

            <div className="cam-preview-footer">
              <span>
                New Collateral:{' '}
                <strong>{fmt(adjustment.adjustedCollateralValue)}</strong>
              </span>
              {parsedAmount > 0 && (
                <span
                  style={{
                    color: ltvDelta.isImprovement ? COLOR.success : COLOR.warning,
                    fontWeight: 600,
                  }}
                >
                  Delta: {ltvDelta.text}
                </span>
              )}
            </div>
          </div>

          {/* Validation Error / Unsafe Withdrawal Warning */}
          {parsedAmount > 0 && !adjustment.isValid && adjustment.errorMessage && (
            <div
              id="collateral-adjust-error"
              role="alert"
              aria-live="polite"
              className="cam-alert cam-alert--danger"
            >
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <div>
                <strong>Unsafe Adjustment</strong>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                  {adjustment.errorMessage}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'pending' && (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: `3px solid ${COLOR.border}`,
              borderTopColor: COLOR.accent,
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              animation: 'spin 1s linear infinite',
            }}
            aria-hidden="true"
          />
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: COLOR.text }}>
            {mode === 'add' ? 'Adding Collateral' : 'Withdrawing Collateral'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: COLOR.muted }}>
            Confirming collateral adjustment on network...
          </p>
        </div>
      )}

      {step === 'error' && (
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: 'rgba(248,81,73,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <AlertCircle size={30} color={COLOR.danger} aria-hidden="true" />
          </div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: COLOR.text }}>
            Adjustment Failed
          </h3>
          <p role="alert" style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: COLOR.muted }}>
            {errorMessage || 'Unable to complete collateral adjustment.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="cam-btn cam-btn--primary focus-ring"
              style={{ flex: 1 }}
              onClick={handleSubmit}
            >
              Retry
            </button>
            <button
              type="button"
              className="cam-btn cam-btn--ghost focus-ring"
              style={{ flex: 1 }}
              onClick={() => setStep('input')}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: COLOR.success,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <CheckCircle size={30} color="#fff" aria-hidden="true" />
          </div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: COLOR.text }}>
            {mode === 'add' ? 'Collateral Added!' : 'Collateral Withdrawn!'}
          </h3>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: COLOR.muted }}>
            Successfully {mode === 'add' ? 'added' : 'withdrew'} {fmt(parsedAmount)} of collateral.
            Your new LTV is{' '}
            <strong style={{ color: COLOR.text }}>
              {fmtLtv(adjustment.adjustedSnapshot.ltvRatio)}
            </strong>
            .
          </p>
          <button
            type="button"
            className="cam-btn cam-btn--primary focus-ring"
            style={{ width: '100%' }}
            onClick={handleSuccessClose}
          >
            Done
          </button>
        </div>
      )}

      {step === 'input' && (
        <div className="cam-footer">
          <button
            type="button"
            className="cam-btn cam-btn--ghost focus-ring"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cam-btn cam-btn--primary focus-ring"
            disabled={!adjustment.isValid || parsedAmount <= 0}
            onClick={handleSubmit}
          >
            {mode === 'add' ? 'Add Collateral' : 'Withdraw Collateral'}
          </button>
        </div>
      )}
    </Modal>
  );
}
