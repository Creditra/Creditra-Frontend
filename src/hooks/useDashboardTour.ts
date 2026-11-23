import { useState, useRef, useCallback } from 'react';

export function useDashboardTour() {
  const [isExplainOpen, setIsExplainOpen] = useState(false);
  const explainTriggerRef = useRef<HTMLButtonElement>(null);

  const openExplain = useCallback(() => setIsExplainOpen(true), []);
  const closeExplain = useCallback(() => setIsExplainOpen(false), []);

  return {
    isExplainOpen,
    explainTriggerRef,
    openExplain,
    closeExplain,
  };
}
