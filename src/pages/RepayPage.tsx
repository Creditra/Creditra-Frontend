import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ConnectWalletPrompt } from '@/components/ConnectWalletPrompt';
import { InlineHelpOverlay } from '@/components/InlineHelpOverlay';
import { KbdHint } from '@/components/KbdHint';
import { LiveRegion } from '@/components/LiveRegion';
import { RepayPreviewModal } from '@/components/RepayPreviewModal';
import { AmountStep } from '@/components/repay/AmountStep';
import { DraftRecoveryPrompt } from '@/components/repay/DraftRecoveryPrompt';
import { PickLineStep } from '@/components/repay/PickLineStep';
import { RepayPageSkeleton } from '@/components/repay/RepayPageSkeleton';
import { ReviewStep } from '@/components/repay/ReviewStep';
import { SEVERITY_CONFIG } from '@/components/repay/repaySeverity';
import { motionClasses, useReducedMotion } from '@/context/ReducedMotionContext';
import { useCreditLines } from '@/hooks/useCreditLines';
import { useRepayFlow } from '@/hooks/useRepayFlow';
import { getAccruedInterest } from '@/lib/interest';
import { getRepayableLines } from '@/lib/repay-eligibility';
import { SETTLEMENT_ASSET } from '@/lib/repayable-balance';
import type { OptimiseRepaymentLine } from '@/utils/suggestRepay';
import { roundToCents } from '@/utils/currency';
import './RepayPage.css';

export { RepayPageSkeleton };

/**
 * RepayPage — composition root for the repayment wizard.
 *
 * Flow state (step, draft recovery, review balance, announcements) lives in
 * `useRepayFlow`; each step renders from `src/components/repay/`.
 *
 * Reduced-motion strategy: all CSS transitions are neutralised globally by the
 * `prefers-reduced-motion: reduce` reset in src/index.css. Transition utility
 * classes are only applied through `motionClasses(...)`, so they drop out of
 * the DOM entirely whenever reduced motion is active.
 */
export default function RepayPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('line');
  const {
    lines: mockLines,
    status: creditStatus,
    error: creditError,
    refetch: refetchCreditLines,
  } = useCreditLines();
  const { isReducedMotionActive } = useReducedMotion();

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);

  // Issue #1185: getRepayableLines (utilized > 0 && status !== Closed) replaces
  // the old Active-only filter so Suspended and Defaulted lines are visible.
  const creditLines = useMemo(() => getRepayableLines(mockLines), [mockLines]);

  const flow = useRepayFlow({
    preselectedId,
    creditLines,
    allLines: mockLines,
    creditStatus,
    navigate,
  });

  const optimiserLines = useMemo<OptimiseRepaymentLine[]>(() => {
    const now = new Date();
    return creditLines.map((cl) => ({
      id: cl.id,
      name: cl.name,
      balance: roundToCents(cl.utilized + getAccruedInterest(cl, now)),
      apr: cl.apr,
      minimumPayment: cl.nextPaymentAmount,
      status: cl.status,
    }));
  }, [creditLines]);

  const handleToggleMultiLineMode = () => {
    setIsMultiLineMode((prev) => {
      const next = !prev;
      flow.announce(
        next
          ? 'Multi-line repayment mode enabled. Select credit lines to repay.'
          : 'Single-line repayment mode enabled.',
      );
      return next;
    });
  };

  if (!flow.selectedLine) {
    return (
      <PickLineStep
        creditStatus={creditStatus}
        creditError={creditError}
        refetchCreditLines={refetchCreditLines}
        creditLines={creditLines}
        unrepayableDeepLink={flow.unrepayableDeepLink}
        optimiserLines={optimiserLines}
        walletBalance={flow.walletBalance}
        onApplyPlan={flow.applyOptimisedPlan}
        isMultiLineMode={isMultiLineMode}
        onToggleMultiLineMode={handleToggleMultiLineMode}
        walletStatus={flow.walletStatus}
        wallet={flow.wallet}
        hasRepayableBalance={flow.hasRepayableBalance}
        isReducedMotionActive={isReducedMotionActive}
        discardReason={flow.draftDiscardReason}
        recoveredDraft={flow.recoveredDraft}
        showRecoveryPrompt={flow.showRecoveryPrompt}
        onRestoreDraft={flow.restoreDraft}
        onDismissDraft={flow.dismissDraft}
        srAnnouncement={flow.srAnnouncement}
        onBack={() => navigate(-1)}
        onSelectLine={flow.selectLine}
        preselectedId={preselectedId}
        announce={flow.announce}
        navigate={navigate}
      />
    );
  }

  if (flow.walletStatus !== 'connected' || !flow.wallet) {
    return (
      <div className="repay-page mx-auto max-w-2xl space-y-6 px-4 py-8">
        <ConnectWalletPrompt assetCode={SETTLEMENT_ASSET.code} />
        <LiveRegion message={flow.srAnnouncement} />
      </div>
    );
  }

  const selectedLine = flow.selectedLine;
  const oldPct = Math.round((selectedLine.utilized / selectedLine.limit) * 100);
  const newPct = Math.round((flow.remainingDebt / selectedLine.limit) * 100);
  const activeTone = SEVERITY_CONFIG[flow.validation?.feedback.severity ?? 'info'];

  return (
    <div className="repay-page mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <button
        type="button"
        aria-label={flow.step === 'input' ? 'Back to credit lines' : 'Back to input'}
        onClick={flow.handleBack}
        className={`rp-back-btn mb-4 inline-flex items-center gap-1.5 rounded-md text-sm text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${motionClasses(isReducedMotionActive, 'transition-colors hover:text-foreground')}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span className="flex items-center gap-1.5">
          {flow.step === 'input' ? 'Back to credit lines' : 'Back to input'}
          <KbdHint keys={['Esc']} />
        </span>
      </button>

      <DraftRecoveryPrompt
        discardReason={flow.draftDiscardReason}
        draft={flow.recoveredDraft}
        isOpen={flow.showRecoveryPrompt}
        onRestore={flow.restoreDraft}
        onDismiss={flow.dismissDraft}
      />

      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted">
            Repay Credit
          </p>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {flow.step === 'review'
              ? 'Review your repayment'
              : 'Make a repayment'}
          </h1>
          <p className="text-sm text-muted">
            {selectedLine.name} &middot; <span className="num-tabular">{selectedLine.apr}%</span> APR
          </p>
        </header>

        {flow.step === 'input' && (
          <AmountStep
            selectedLine={selectedLine}
            amountStr={flow.amountStr}
            setAmountStr={flow.setAmountStr}
            validation={flow.validation}
            repayableBalance={flow.repayableBalance}
            hasRepayableBalance={flow.hasRepayableBalance}
            walletBalance={flow.walletBalance}
            suggestion={flow.suggestion}
            suggestionMessage={flow.suggestionMessage}
            suggestionTone={SEVERITY_CONFIG[flow.suggestionTone]}
            activeTone={activeTone}
            smartPayDisabled={flow.smartPayDisabled}
            isInvalid={flow.isInvalid}
            amount={flow.amount}
            remainingDebt={flow.remainingDebt}
            oldPct={oldPct}
            newPct={newPct}
            accruedInterest={flow.accruedInterest}
            accruedDays={flow.accruedDays}
            isAutoSchedule={flow.isAutoSchedule}
            setIsAutoSchedule={flow.setIsAutoSchedule}
            isReducedMotionActive={isReducedMotionActive}
            handlePercent={flow.handlePercent}
            handleSmartPay={flow.handleSmartPay}
            handleReview={flow.handleReview}
            setIsPreviewModalOpen={setIsPreviewModalOpen}
            setIsHelpOpen={setIsHelpOpen}
            previewTriggerRef={previewTriggerRef}
            helpTriggerRef={helpTriggerRef}
            onCancel={flow.cancel}
            draftSave={flow.draftSave}
          />
        )}

        {flow.step === 'review' && (
          <ReviewStep
            selectedLine={selectedLine}
            amount={flow.amount}
            remainingDebt={flow.remainingDebt}
            walletBalance={flow.walletBalance}
            reviewBalance={flow.reviewBalance}
            isReviewBalanceLoading={flow.isReviewBalanceLoading}
            reviewBalanceError={flow.reviewBalanceError}
            isOfflineBlocked={flow.isOfflineBlocked}
            isInvalid={flow.isInvalid}
            validation={flow.validation}
            isAutoSchedule={flow.isAutoSchedule}
            allocation={flow.allocation}
            accruedInterest={flow.accruedInterest}
            accruedDays={flow.accruedDays}
            needsConfirm={flow.needsConfirm}
            confirmAmountStr={flow.confirmAmountStr}
            setConfirmAmountStr={flow.setConfirmAmountStr}
            isReviewConfirmDisabled={flow.isReviewConfirmDisabled}
            isReducedMotionActive={isReducedMotionActive}
            handleBack={flow.handleBack}
            handleConfirm={flow.handleConfirm}
            draftSave={flow.draftSave}
          />
        )}
      </div>

      <InlineHelpOverlay
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        triggerRef={helpTriggerRef}
      />
      <RepayPreviewModal
        isOpen={isPreviewModalOpen}
        creditLine={selectedLine}
        walletBalance={flow.walletBalance}
        repayAmount={flow.amount}
        onClose={() => setIsPreviewModalOpen(false)}
        onConfirm={() => {
          setIsPreviewModalOpen(false);
          void flow.handleConfirm();
        }}
        triggerRef={previewTriggerRef}
      />

      <LiveRegion id="repay-announcement" message={flow.srAnnouncement} />
    </div>
  );
}
