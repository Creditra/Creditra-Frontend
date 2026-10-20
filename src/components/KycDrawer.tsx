/**
 * KycDrawer — right-side panel (mobile: bottom sheet) showing KYC progress.
 *
 * Opened from the header via KycTriggerButton. Displays an ordered list of
 * KYC steps with their statuses and a "Resume" CTA that links to the first
 * incomplete step. Resumes where the user left off by reading `resumeStepId`
 * from KycContext.
 *
 * Accessibility:
 *   role="dialog", aria-modal="true", aria-labelledby
 *   Full focus trap (useFocusTrap), scroll lock, inert backdrop
 *   Step icons: aria-hidden, status communicated via text + colour + shape
 *   Progress bar: role="progressbar" with valuenow/valuemin/valuemax
 *   WCAG 2.1 AA: 1.4.1, 2.1.1, 2.4.3, 4.1.2
 */
import React, { useEffect, useRef, useState } from 'react';
import { useKyc } from '../context/KycContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import type { KycOverallStatus, KycStep, KycStepStatus } from '../types/kyc';
import './KycDrawer.css';

// ─── Props ────────────────────────────────────────────────────────────────────

interface KycDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the user presses "Resume". Receives the step id to navigate
   * to. The parent (or a router) handles the actual navigation.
   */
  onResume: (stepId: string) => void;
  /** Ref to the header trigger button for return-focus on close. */
  triggerRef?: React.RefObject<HTMLElement | null>;
}

// ─── Status display metadata ──────────────────────────────────────────────────

const STATUS_META: Record<
  KycStepStatus,
  { label: string; icon: string; ariaLabel: string }
> = {
  not_started:  { label: 'Not started', icon: '○',  ariaLabel: 'Not started' },
  in_progress:  { label: 'In progress', icon: '◑',  ariaLabel: 'In progress' },
  completed:    { label: 'Completed',   icon: '✓',  ariaLabel: 'Completed'   },
  failed:       { label: 'Failed',      icon: '✕',  ariaLabel: 'Failed – action required' },
  pending:      { label: 'Under review',icon: '⋯',  ariaLabel: 'Pending review' },
};

const OVERALL_STATUS_LABEL: Record<KycOverallStatus, string> = {
  not_started:   'Not started',
  in_progress:   'In progress',
  under_review:  'Under review',
  approved:      'Approved',
  rejected:      'Rejected',
};

// ─── Helper: human-readable timestamp ────────────────────────────────────────

function fmtTimestamp(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

// ─── Step row ────────────────────────────────────────────────────────────────

function StepRow({
  step,
  isCurrentStep,
  stepNumber,
}: {
  step: KycStep;
  isCurrentStep: boolean;
  stepNumber: number;
}) {
  const meta = STATUS_META[step.status];
  const ts   = fmtTimestamp(step.updatedAt);

  return (
    <li
      className={`kyc-step kyc-step--${step.status}`}
      aria-current={isCurrentStep ? 'step' : undefined}
    >
      {/* Icon — aria-hidden; status announced by the visually-hidden span */}
      <div className="kyc-step__icon" aria-hidden="true">
        {step.status === 'not_started' ? stepNumber : meta.icon}
      </div>

      <div className="kyc-step__content">
        <p className="kyc-step__label">
          {step.label}
          {isCurrentStep && (
            <span className="kyc-step__current-tag" aria-hidden="true">
              Current
            </span>
          )}
          {/* Screen-reader status announcement */}
          <span className="sr-only"> — {meta.ariaLabel}</span>
        </p>
        <p className="kyc-step__description">{step.description}</p>
        {ts && (
          <p className="kyc-step__timestamp">
            <span className="sr-only">Last updated: </span>
            {ts}
          </p>
        )}
      </div>
    </li>
  );
}

// ─── Main drawer ─────────────────────────────────────────────────────────────

const DRAWER_ID = 'kyc-progress-drawer';

export function KycDrawer({ isOpen, onClose, onResume, triggerRef }: KycDrawerProps) {
  const { steps, overallStatus, resumeStepId, completedCount } = useKyc();
  const [showStickyActions, setShowStickyActions] = useState(false);
  const bodyRef = useRef<HTMLElement | null>(null);

  const containerRef = useFocusTrap({ isActive: isOpen, triggerRef, onEscape: onClose });
  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId: DRAWER_ID });

  useEffect(() => {
    if (!isOpen) {
      setShowStickyActions(false);
      return;
    }

    const scrollEl = bodyRef.current;
    if (!scrollEl) return;

    const updateStickyActions = () => {
      setShowStickyActions(scrollEl.scrollTop > 24);
    };

    updateStickyActions();
    scrollEl.addEventListener('scroll', updateStickyActions, { passive: true });

    return () => {
      scrollEl.removeEventListener('scroll', updateStickyActions);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps     = steps.length;
  const progressPct    = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const canResume      = resumeStepId !== null;
  const isFullyDone    = overallStatus === 'approved' || overallStatus === 'under_review';
  // "Start" vs "Resume": show Start only when nothing has been touched yet.
  const hasStarted     = overallStatus !== 'not_started';

  const handleResume = () => {
    if (resumeStepId) {
      onResume(resumeStepId);
      onClose();
    }
  };

  return (
    <div id={DRAWER_ID} className="kyc-drawer-portal">
      {/* Backdrop */}
      <div
        className="kyc-drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-drawer-title"
        aria-describedby="kyc-drawer-desc"
        className="kyc-drawer"
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        {/* ── Header ── */}
        <div className="kyc-drawer__header">
          <div className="kyc-drawer__header-text">
            <p className="kyc-drawer__kicker">GrantFox · Verification</p>
            <h2 id="kyc-drawer-title" className="kyc-drawer__title">
              KYC Progress
            </h2>
            <p id="kyc-drawer-desc" className="kyc-drawer__subtitle">
              Complete all steps to unlock your full credit limit.
            </p>
          </div>
          <button
            type="button"
            className="kyc-drawer__close"
            aria-label="Close KYC progress drawer"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6"  y2="18" />
              <line x1="6"  y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── Status row ── */}
        <div className="kyc-drawer__status-row" aria-live="polite" aria-atomic="true">
          <span
            className={`kyc-status-badge kyc-status-badge--${overallStatus}`}
            role="status"
          >
            {OVERALL_STATUS_LABEL[overallStatus]}
          </span>
          <span className="kyc-drawer__progress-text" aria-hidden="true">
            {completedCount} / {totalSteps} steps
          </span>
          <span className="sr-only">
            {completedCount} of {totalSteps} steps completed.
          </span>
        </div>

        {/* ── Progress bar ── */}
        <div
          className="kyc-drawer__progress-bar-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`KYC progress: ${progressPct}%`}
        >
          <div
            className="kyc-drawer__progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* ── Step list ── */}
        <nav
          ref={bodyRef}
          aria-label="KYC verification steps"
          className="kyc-drawer__body"
        >
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {steps.map((step, i) => (
              <StepRow
                key={step.id}
                step={step}
                isCurrentStep={step.id === resumeStepId}
                stepNumber={i + 1}
              />
            ))}
          </ol>
        </nav>

        {/* ── Footer ── */}
        <div
          className={`kyc-drawer__footer ${showStickyActions ? 'kyc-drawer__footer--sticky-visible' : ''}`}
          data-sticky-visible={showStickyActions ? 'true' : 'false'}
        >
          <button
            type="button"
            className="kyc-drawer__resume-btn"
            onClick={handleResume}
            disabled={!canResume}
            aria-disabled={!canResume}
            aria-describedby={!canResume ? 'kyc-resume-hint' : undefined}
          >
            {isFullyDone ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                All steps submitted
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {hasStarted ? 'Resume verification' : 'Start verification'}
              </>
            )}
          </button>

          {!canResume && !isFullyDone && (
            <p
              id="kyc-resume-hint"
              className="sr-only"
              role="status"
            >
              All incomplete steps have been submitted for review.
            </p>
          )}

          <a
            href="/help#kyc"
            className="kyc-drawer__help-link"
            onClick={onClose}
          >
            Need help with verification?
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Header trigger button ────────────────────────────────────────────────────

interface KycTriggerButtonProps {
  onClick: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * Small header button that opens the KYC drawer.
 * Shows a coloured dot indicator when there is outstanding action required.
 */
export function KycTriggerButton({ onClick, triggerRef }: KycTriggerButtonProps) {
  const { overallStatus } = useKyc();

  // Only show the dot for statuses that need user attention.
  const showDot = overallStatus !== 'not_started' && overallStatus !== 'approved';

  const dotLabel = showDot
    ? `KYC ${OVERALL_STATUS_LABEL[overallStatus].toLowerCase()}`
    : '';

  return (
    <button
      ref={triggerRef}
      type="button"
      className="kyc-trigger-btn"
      onClick={onClick}
      aria-label={`KYC verification${dotLabel ? ` — ${dotLabel}` : ''}`}
      aria-haspopup="dialog"
    >
      {/* Shield icon */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      <span>KYC</span>
      {showDot && (
        <span
          className={`kyc-trigger-btn__dot kyc-trigger-btn__dot--${overallStatus}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
