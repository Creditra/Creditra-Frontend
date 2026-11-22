import { DashboardTour } from '../DashboardTour';
import { RiskExplainerOverlay } from '../RiskExplainerOverlay';
import type { RefObject } from 'react';

export function DashboardTourSection({
  isExplainOpen,
  explainTriggerRef,
  closeExplain,
}: {
  isExplainOpen: boolean;
  explainTriggerRef: RefObject<HTMLButtonElement | null>;
  closeExplain: () => void;
}) {
  return (
    <>
      <DashboardTour />
      <RiskExplainerOverlay
        isOpen={isExplainOpen}
        onClose={closeExplain}
        triggerRef={explainTriggerRef}
      />
    </>
  );
}
