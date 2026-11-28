import type { RefObject } from 'react';
import { DraftSavedIndicator } from '@/components/DraftSavedIndicator';
import { KbdHint } from '@/components/KbdHint';
import { motionClasses } from '@/context/ReducedMotionContext';
import type { UseDraftSaveStatusResult } from '@/hooks/useDraftSaveStatus';
import { formatMoney } from '@/utils/amountValidation';

interface RepayPreviewCardProps {
  amount: number;
  remainingDebt: number;
  oldPct: number;
  newPct: number;
  isAutoSchedule: boolean;
  setIsAutoSchedule: (value: boolean) => void;
  isReducedMotionActive: boolean;
  handleReview: () => void;
  hasRepayableBalance: boolean;
  isInvalid: boolean;
  setIsPreviewModalOpen: (open: boolean) => void;
  previewTriggerRef: RefObject<HTMLButtonElement>;
  draftSave: UseDraftSaveStatusResult;
}

/**
 * Live before/after preview plus auto-schedule and the review actions.
 */
export function RepayPreviewCard({
  amount,
  remainingDebt,
  oldPct,
  newPct,
  isAutoSchedule,
  setIsAutoSchedule,
  isReducedMotionActive,
  handleReview,
  hasRepayableBalance,
  isInvalid,
  setIsPreviewModalOpen,
  previewTriggerRef,
  draftSave,
}: RepayPreviewCardProps) {
  return (
  <div className="rounded-lg border border-border bg-surface p-4">
    <p className="text-xs font-semibold uppercase text-muted">
      Preview
    </p>
    <div className="mt-3 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Remaining debt</span>
        <span
          className={`font-semibold num-tabular ${
            amount > 0 && remainingDebt === 0
              ? 'text-success'
              : 'text-foreground'
          }`}
        >
          {formatMoney(remainingDebt)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">New utilization</span>
        <span className="font-semibold text-foreground">
          <span className="num-tabular">{newPct}%</span>
          <span className="ml-1.5 text-muted line-through num-tabular">
            {oldPct}%
          </span>
      </span>
    </div>

    {/* cb-v7: pattern class on both bars so old and new utilization
        are told apart without colour alone. */}
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full transition-all motion-reduce:transition-none rp-progress--ghost`}
        style={{ width: `${oldPct}%` }}
        aria-hidden="true"
      />
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full transition-all ${newPct > 80 ? 'rp-progress--high' : newPct > 50 ? 'rp-progress--medium' : 'rp-progress--low'}`}
        style={{ width: `${newPct}%` }}
        aria-hidden="true"
      />
    </div>
    </div>  {/* closes the space-y-3 wrapper */}

    <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
      <div>
        <label
          htmlFor="auto-schedule-toggle"
          className="text-sm font-medium text-foreground cursor-pointer"
          onClick={() => setIsAutoSchedule(!isAutoSchedule)}
        >
          Auto-schedule
        </label>
        <p className="text-xs text-muted">Repeat this payment monthly</p>
      </div>
      <button
        id="auto-schedule-toggle"
        type="button"
        role="switch"
        aria-checked={isAutoSchedule}
        onClick={() => setIsAutoSchedule(!isAutoSchedule)}
        className={`rp-toggle-switch relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isAutoSchedule ? 'bg-accent' : 'bg-border'
        } ${motionClasses(isReducedMotionActive, 'transition-colors duration-200 ease-in-out')}`}
      >
        <span
          aria-hidden="true"
          className={`repay-page__toggle-thumb pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 ${
            isAutoSchedule ? 'translate-x-5' : 'translate-x-0'
          } ${motionClasses(isReducedMotionActive, 'transition duration-200 ease-in-out')}`}
        />
      </button>
    </div>

    <div className="mt-4 flex flex-col gap-2">
      <button
        type="button"
        onClick={handleReview}
        disabled={!hasRepayableBalance || isInvalid || amount <= 0}
        className={`rp-review-btn w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${motionClasses(isReducedMotionActive, 'transition-all hover:brightness-110')}`}
      >
        <span className="flex items-center justify-center gap-2">
          Review Repayment <KbdHint keys={['Enter']} />
        </span>
      </button>
      <button
        ref={previewTriggerRef}
        type="button"
        onClick={() => setIsPreviewModalOpen(true)}
        disabled={!hasRepayableBalance || isInvalid || amount <= 0}
        className={`rp-preview-btn w-full rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${motionClasses(isReducedMotionActive, 'transition-all hover:bg-accent/20')}`}
      >
        Preview Consequences Modal
      </button>
      <DraftSavedIndicator
        status={draftSave.status}
        savedAt={draftSave.savedAt}
        className="text-center"
      />
    </div>
  </div>
  );
}
