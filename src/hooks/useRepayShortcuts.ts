import { useEffect } from 'react';

interface UseRepayShortcutsOptions {
  step: 'input' | 'review';
  hasSelectedLine: boolean;
  isInvalid: boolean;
  amount: number;
  isReviewConfirmDisabled: boolean;
  onBack: () => void;
  onSmartPay: () => void;
  onMax: () => void;
  onReview: () => void;
  onConfirm: () => void;
}

/**
 * Keyboard shortcuts for the repayment wizard:
 * `S` Smart Pay, `M` max amount, `Enter` review/confirm, `Esc` back.
 *
 * Ignored while focus is in a text field or on an interactive control so
 * typing an amount never triggers a shortcut.
 */
export function useRepayShortcuts({
  step,
  hasSelectedLine,
  isInvalid,
  amount,
  isReviewConfirmDisabled,
  onBack,
  onSmartPay,
  onMax,
  onReview,
  onConfirm,
}: UseRepayShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('button, a, select, dialog, [role="dialog"]')) {
        return;
      }

      if (e.key === 'Escape') {
        onBack();
      } else if (e.key === 's' || e.key === 'S') {
        if (step === 'input' && hasSelectedLine) onSmartPay();
      } else if (e.key === 'm' || e.key === 'M') {
        if (step === 'input' && hasSelectedLine) onMax();
      } else if (e.key === 'Enter') {
        if (step === 'input' && hasSelectedLine && !isInvalid && amount > 0) {
          onReview();
        } else if (step === 'review' && !isReviewConfirmDisabled) {
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    step,
    hasSelectedLine,
    isInvalid,
    amount,
    isReviewConfirmDisabled,
    onBack,
    onSmartPay,
    onMax,
    onReview,
    onConfirm,
  ]);
}
