import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Amount } from '@/components/Amount';
import { formatMoney } from '@/utils/amountValidation';
import type { RepayDraftState } from '@/state/repayDraft';

/**
 * Reason a saved draft was discarded instead of being offered for recovery.
 * Surfaced as a `role="status"` note so the discard is never silent
 * (issue #1188).
 */
export type DraftDiscardReason = 'owner-mismatch' | 'line-unrepayable';

export const DRAFT_DISCARD_MESSAGE: Record<DraftDiscardReason, string> = {
  'owner-mismatch':
    'Saved repayment draft discarded — it belongs to a different wallet.',
  'line-unrepayable':
    'Saved repayment draft discarded — that credit line can no longer be repaid.',
};

interface DraftRecoveryPromptProps {
  discardReason: DraftDiscardReason | null;
  draft: RepayDraftState | null;
  isOpen: boolean;
  onRestore: () => void;
  onDismiss: () => void;
}

/**
 * Draft-recovery UI for the repayment wizard: the "discarded" note plus the
 * resume/start-fresh prompt. Rendered on both the credit-line picker and the
 * repayment form so recovery is available wherever the flow resumes.
 */
export function DraftRecoveryPrompt({
  discardReason,
  draft,
  isOpen,
  onRestore,
  onDismiss,
}: DraftRecoveryPromptProps) {
  return (
    <>
      {discardReason && (
        <div
          role="status"
          aria-live="polite"
          className="mb-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          data-testid="repay-draft-discarded-note"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{DRAFT_DISCARD_MESSAGE[discardReason]}</span>
        </div>
      )}

      {isOpen && draft && (
        <div
          className="mb-4 flex items-start gap-3 rounded-lg border border-accent/40 bg-accent/10 p-4"
          role="alert"
          aria-live="polite"
          data-testid="repay-recovery-prompt"
        >
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              Recover interrupted repayment?
            </p>
            <p className="mt-1 text-xs text-muted">
              You have a saved repayment draft for credit line{' '}
              <span className="font-medium text-foreground">{draft.creditLineId}</span>
              {' '}—{' '}
              <span className="font-medium text-foreground num-tabular">
                <Amount
                  value={parseFloat(draft.amountStr) || 0}
                  format={formatMoney}
                  maskedLabel="Repayment amount hidden for privacy"
                />
              </span>
              . Saved {new Date(draft.savedAt).toLocaleTimeString()}.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={onRestore}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-restore"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Resume
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                data-testid="repay-recovery-dismiss"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
