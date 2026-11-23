import React, { useEffect, useRef, useState } from 'react';
import { useKyc } from '../context/KycContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useInertBackdrop } from '../hooks/useInertBackdrop';
import type { KycOverallStatus, KycStep, KycStepStatus } from '../types/kyc';
import './KycBottomSheet.css';

interface KycBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onResume: (stepId: string) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

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
      className={`kyc-sheet-step kyc-sheet-step--${step.status}`}
      aria-current={isCurrentStep ? 'step' : undefined}
    >
      <div className="kyc-sheet-step__icon" aria-hidden="true">
        {step.status === 'not_started' ? stepNumber : meta.icon}
      </div>

      <div className="kyc-sheet-step__content">
        <p className="kyc-sheet-step__label">
          {step.label}
          {isCurrentStep && (
            <span className="kyc-sheet-step__current-tag" aria-hidden="true">
              Current
            </span>
          )}
          <span className="sr-only"> — {meta.ariaLabel}</span>
        </p>
        <p className="kyc-sheet-step__description">{step.description}</p>
        {ts && (
          <p className="kyc-sheet-step__timestamp">
            <span className="sr-only">Last updated: </span>
            {ts}
          </p>
        )}
      </div>
    </li>
  );
}

const SHEET_ID = 'kyc-bottom-sheet';

export function KycBottomSheet({ isOpen, onClose, onResume, triggerRef }: KycBottomSheetProps) {
  const { steps, overallStatus, resumeStepId, completedCount } = useKyc();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragInitialOffset = useRef(0);

  const containerRef = useFocusTrap({ isActive: isOpen, triggerRef, onEscape: onClose });
  useBodyScrollLock({ isLocked: isOpen });
  useInertBackdrop({ isInert: isOpen, modalId: SHEET_ID });

  useEffect(() => {
    if (isOpen) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
    dragInitialOffset.current = dragOffset;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const delta = clientY - dragStartY.current;
    if (delta > 0) {
      setDragOffset(delta * 0.5);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset > 120) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => handleDragStart(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => handleDragMove(e.touches[0].clientY);
  const handleTouchEnd = () => handleDragEnd();

  const handleMouseStart = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const handleMouseUp = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  const totalSteps  = steps.length;
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const canResume   = resumeStepId !== null;
  const isFullyDone = overallStatus === 'approved' || overallStatus === 'under_review';
  const hasStarted  = overallStatus !== 'not_started';

  const handleResume = () => {
    if (resumeStepId) {
      onResume(resumeStepId);
      onClose();
    }
  };

  const sheetStyle: React.CSSProperties = {};
  if (isDragging && dragOffset > 0) {
    sheetStyle.transform = `translateY(${dragOffset}px)`;
    sheetStyle.transition = 'none';
  }

  return (
    <div id={SHEET_ID} className="kyc-sheet-portal">
      <div
        className="kyc-sheet-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={(el) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-sheet-title"
        aria-describedby="kyc-sheet-desc"
        className={`kyc-sheet ${isDragging ? 'kyc-sheet--dragging' : ''}`}
        style={sheetStyle}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <div
          className="kyc-sheet__drag-handle"
          role="presentation"
          aria-hidden="true"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseStart}
        >
          <span className="kyc-sheet__drag-bar" />
        </div>

        <div className="kyc-sheet__header">
          <div className="kyc-sheet__header-text">
            <p className="kyc-sheet__kicker">GrantFox · Verification</p>
            <h2 id="kyc-sheet-title" className="kyc-sheet__title">
              KYC Progress
            </h2>
            <p id="kyc-sheet-desc" className="kyc-sheet__subtitle">
              Complete all steps to unlock your full credit limit.
            </p>
          </div>
          <button
            type="button"
            className="kyc-sheet__close"
            aria-label="Close KYC bottom sheet"
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

        <div className="kyc-sheet__status-row" aria-live="polite" aria-atomic="true">
          <span
            className={`kyc-sheet-badge kyc-sheet-badge--${overallStatus}`}
            role="status"
          >
            {OVERALL_STATUS_LABEL[overallStatus]}
          </span>
          <span className="kyc-sheet__progress-text" aria-hidden="true">
            {completedCount} / {totalSteps} steps
          </span>
          <span className="sr-only">
            {completedCount} of {totalSteps} steps completed.
          </span>
        </div>

        <div
          className="kyc-sheet__progress-bar-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`KYC progress: ${progressPct}%`}
        >
          <div
            className="kyc-sheet__progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <nav
          ref={bodyRef}
          aria-label="KYC verification steps"
          className="kyc-sheet__body"
        >
          <ol className="kyc-sheet__step-list">
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

        <div className="kyc-sheet__footer">
          <button
            type="button"
            className="kyc-sheet__resume-btn"
            onClick={handleResume}
            disabled={!canResume}
            aria-disabled={!canResume}
            aria-describedby={!canResume && !isFullyDone ? 'kyc-sheet-resume-hint' : undefined}
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
              id="kyc-sheet-resume-hint"
              className="sr-only"
              role="status"
            >
              All incomplete steps have been submitted for review.
            </p>
          )}

          <a
            href="/help#kyc"
            className="kyc-sheet__help-link"
            onClick={onClose}
          >
            Need help with verification?
          </a>
        </div>
      </div>
    </div>
  );
}
