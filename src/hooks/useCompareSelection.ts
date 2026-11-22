import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadComparisonSelection,
  saveComparisonSelection,
} from '../utils/comparisonSelection';
import { useInertBackdrop } from './useInertBackdrop';
import { useBodyScrollLock } from './useBodyScrollLock';

export function useCompareSelection() {
  const [selectedCompareLines, setSelectedCompareLines] = useState<string[]>(
    () => loadComparisonSelection(),
  );
  const [showCompare, setShowCompare] = useState(false);
  const compareTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveComparisonSelection(selectedCompareLines);
  }, [selectedCompareLines]);

  const handleOpenCompare = useCallback(() => {
    if (selectedCompareLines.length === 2) {
      setShowCompare(true);
    }
  }, [selectedCompareLines.length]);

  const toggleCompareSelection = useCallback((id: string) => {
    setSelectedCompareLines((previous) => {
      if (previous.includes(id)) {
        return previous.filter((lineId) => lineId !== id);
      }
      if (previous.length < 2) {
        return [...previous, id];
      }
      return previous;
    });
  }, []);

  useInertBackdrop({
    isInert: showCompare,
    modalId: 'compare-lines-drawer-dashboard',
  });
  useBodyScrollLock({ isLocked: showCompare });

  return {
    selectedCompareLines,
    compareTriggerRef,
    handleOpenCompare,
    toggleCompareSelection,
  };
}
