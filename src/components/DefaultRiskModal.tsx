/**
 * DefaultRiskModal.tsx
 *
 * GrantFox Campaign: Pre-Borrow Default-Risk Education Gate
 *
 * Purpose:
 *   A 3-step education modal dialog that explains default definitions,
 *   consequences, and avoidance strategies to borrowers on Creditra. The modal
 *   is offered, not forced: it never blocks the draw wizard. Completing all
 *   three steps records an acknowledgement of `RISK_EDUCATION_VERSION` for the
 *   connected wallet; dismissing the banner or the modal does not. The
 *   confirm step shows a non-blocking nudge until the current version is
 *   acknowledged.
 *
 * Props:
 *   - isOpen: boolean indicating whether the modal is visible and active
 *   - onAcknowledge: callback invoked when the user confirms step 3 ("I Understand – Proceed")
 *   - triggerRef: optional React ref to the DOM element that triggered the modal (for focus restoration)
 *
 * Trigger Conditions:
 *   - Opened from the inline primer banner on /draw-credit (first-time borrowers), never auto-opened.
 *   - Learn mode: URL query parameter `?learn=1` forces display regardless of prior acknowledgement.
 *   - Dismissal in learn mode removes `?learn=1` without overwriting localStorage.
 *
 * Accessibility (WCAG 2.1 AA Compliance):
 *   - Criterion 2.1.2 (No Keyboard Trap): Focus is constrained within the dialog via `useFocusTrap`;
 *     Escape, the close button and a backdrop click dismiss it when `onDismiss` is provided.
 *   - Criterion 2.4.3 (Focus Order): Focus is placed on the first interactive control on mount and
 *     restored to `triggerRef` or prior active element on close, with a fallback to the first `main`
 *     landmark when the previous element has been detached while the dialog was open.
 *   - Criterion 4.1.2 (Name, Role, Value): Modal container implements `role="dialog"`, `aria-modal="true"`,
 *     `aria-labelledby` linking to the dynamic step title, and `aria-describedby` linking to the step body.
 *     Step indicator communicates state via `aria-current="step"`.
 *   - Criterion 1.4.1 (Use of Color): Indicators utilize numbers and checkmark icons (`✓`) in addition to
 *     color changes to convey completion state. Visible focus rings inherit `2px solid var(--accent)`.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, AlertTriangle, ShieldCheck, Check, X } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useInertBackdrop } from '@/hooks/useInertBackdrop';
import { useReducedMotion } from '@/context/ReducedMotionContext';
import './DefaultRiskModal.css';

export interface DefaultRiskModalProps {
  isOpen: boolean;
  onAcknowledge: () => void;
  /**
   * Called when the user closes the modal without finishing (close button,
   * Escape or backdrop click). When omitted the modal is non-dismissible.
   */
  onDismiss?: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

interface StepContent {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconVariant: 'info' | 'warning' | 'success';
}

const MODAL_ID = 'default-risk-modal';

const STEPS: StepContent[] = [
  {
    title: 'What is a Default?',
    description:
      'A default occurs when a borrower fails to make required repayments on an active credit line according to the agreed terms and schedule. On Creditra, maintaining your credit line in good standing ensures uninterrupted access to capital and keeps your borrowing terms optimal.',
    icon: <AlertCircle className="w-8 h-8" aria-hidden="true" />,
    iconVariant: 'info',
  },
  {
    title: 'Consequences of Default',
    description:
      'Defaulting on a credit line has serious repercussions: your borrowing privileges are immediately suspended, your on-chain credit score experiences a severe penalty, and automated protocol recovery or collateral liquidation mechanisms may be initiated.',
    icon: <AlertTriangle className="w-8 h-8" aria-hidden="true" />,
    iconVariant: 'warning',
  },
  {
    title: 'How to Avoid Default',
    description:
      'To keep your account in good standing: monitor your active credit lines and payment due dates, maintain a prudent utilization ratio, and make repayments on time. If you foresee repayment difficulties, repay partially or adjust your position ahead of deadlines.',
    icon: <ShieldCheck className="w-8 h-8" aria-hidden="true" />,
    iconVariant: 'success',
  },
];

export function DefaultRiskModal({
  isOpen,
  onAcknowledge,
  onDismiss,
  triggerRef,
}: DefaultRiskModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const { isReducedMotionActive } = useReducedMotion();

  // Reset to first step when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDirection('forward');
    }
  }, [isOpen]);

  // Hook integrations: Focus trap, body scroll lock, and inert backdrop
  const dialogRef = useFocusTrap({
    isActive: isOpen,
    triggerRef,
    // Escape is handled by handleDialogKeyDown (dismisses only when onDismiss is provided).
  });

  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId: MODAL_ID });

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;
  const activeStep = STEPS[currentStep];

  const handleNext = useCallback(() => {
    if (isLastStep) {
      onAcknowledge();
    } else {
      setDirection('forward');
      setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1));
    }
  }, [isLastStep, onAcknowledge]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setDirection('backward');
      setCurrentStep((prev) => Math.max(0, prev - 1));
    }
  }, [isFirstStep]);

  // Intercept keyboard events inside the modal to block Escape key dismissal
  const handleDialogKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDismiss?.();
    }
  }, [onDismiss]);

  if (!isOpen) return null;

  return createPortal(
    <div
      id={MODAL_ID}
      className="default-risk-overlay"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="default-risk-step-title"
        aria-describedby="default-risk-step-desc"
        className="default-risk-card"
        onKeyDown={handleDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Screen Reader Live Region for Step Transitions */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          Step {currentStep + 1} of {STEPS.length}: {activeStep.title}
        </div>

        {/* Modal Header */}
        <header className="default-risk-header">
          <span className="default-risk-badge">
            <span aria-hidden="true">⚠️</span> Borrower Education Gate
          </span>
          <span className="default-risk-header-end">
            <span className="default-risk-step-counter" aria-hidden="true">
              Step {currentStep + 1} of {STEPS.length}
            </span>
            {onDismiss && (
              <button
                type="button"
                className="default-risk-close"
                onClick={onDismiss}
                aria-label="Close default-risk education"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </span>
        </header>

        {/* Step Progress Indicator Strip */}
        <div
          className="default-risk-stepper"
          role="list"
          aria-label="Education progress"
        >
          {STEPS.map((stepItem, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <React.Fragment key={stepItem.title}>
                <div
                  role="listitem"
                  className={`default-risk-indicator ${
                    isCurrent ? 'default-risk-indicator--active' : ''
                  } ${isCompleted ? 'default-risk-indicator--completed' : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${index + 1} of ${STEPS.length}: ${stepItem.title}${
                    isCompleted ? ' – completed' : isCurrent ? ' – current' : ' – upcoming'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`default-risk-connector ${
                      index < currentStep ? 'default-risk-connector--active' : ''
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Animated Step Content */}
        <div className="default-risk-content-area">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="flex flex-col items-center"
              initial={
                isReducedMotionActive
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: direction === 'forward' ? 24 : -24 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                isReducedMotionActive
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: direction === 'forward' ? -24 : 24 }
              }
              transition={{ duration: isReducedMotionActive ? 0 : 0.25 }}
            >
              <div
                className={`default-risk-icon-wrapper default-risk-icon-wrapper--${activeStep.iconVariant}`}
              >
                {activeStep.icon}
              </div>

              <h2 id="default-risk-step-title" className="default-risk-title">
                {activeStep.title}
              </h2>

              <p id="default-risk-step-desc" className="default-risk-desc">
                {activeStep.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Modal Navigation Actions */}
        <footer className="default-risk-actions">
          <button
            type="button"
            className="default-risk-btn-back"
            onClick={handleBack}
            disabled={isFirstStep}
            tabIndex={isFirstStep ? -1 : 0}
            aria-disabled={isFirstStep ? true : undefined}
          >
            Back
          </button>

          <button
            type="button"
            className={isLastStep ? 'default-risk-btn-confirm' : 'default-risk-btn-next'}
            onClick={handleNext}
          >
            {isLastStep ? 'I Understand – Proceed' : 'Next'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
