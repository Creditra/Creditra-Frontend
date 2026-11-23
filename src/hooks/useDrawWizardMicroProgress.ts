import { useEffect, useRef } from "react";
import { useDebounceValue } from "@/hooks/useDebounceValue";
import {
  buildMicroProgressAnnouncement,
  computeDrawWizardMicroProgress,
  type DrawWizardMicroProgressInput,
  type DrawWizardMicroStepState,
} from "@/lib/draw-wizard-micro-progress";

const ANNOUNCEMENT_DEBOUNCE_MS = 300;

/**
 * Derives per-step micro-progress states and a debounced polite announcement
 * string when any step's validity changes.
 *
 * The announcement is derived from *debounced inputs* (not a debounced
 * output string). Diffing on every render — as a naive
 * `buildMicroProgressAnnouncement(previousRenderSteps, currentSteps)` would
 * — only produces a non-empty result on the one render where a change is
 * first detected; the very next render (e.g. the next keystroke while
 * typing a multi-digit amount) sees an unchanged tone and emits `""`. That
 * blip-then-revert pattern defeats a debounce applied to the *output*
 * string, since each new render's value differs from the last and keeps
 * resetting the timer, so the announcement is dropped whenever more than
 * one input change arrives within the debounce window. Debouncing the
 * *inputs* first means the diff only runs once the user has paused, so a
 * genuine change reliably survives long enough to be announced.
 */
export function useDrawWizardMicroProgress(input: DrawWizardMicroProgressInput): {
  steps: DrawWizardMicroStepState[];
  debouncedAnnouncement: string;
} {
  const { selectedCreditLine, amount, confirmationAcknowledged, isOnConfirmStep } =
    input;

  const steps = computeDrawWizardMicroProgress(input);

  const debouncedCreditLine = useDebounceValue(
    selectedCreditLine,
    ANNOUNCEMENT_DEBOUNCE_MS,
  );
  const debouncedAmount = useDebounceValue(amount, ANNOUNCEMENT_DEBOUNCE_MS);
  const debouncedConfirmationAcknowledged = useDebounceValue(
    confirmationAcknowledged,
    ANNOUNCEMENT_DEBOUNCE_MS,
  );
  const debouncedIsOnConfirmStep = useDebounceValue(
    isOnConfirmStep,
    ANNOUNCEMENT_DEBOUNCE_MS,
  );

  const settledSteps = computeDrawWizardMicroProgress({
    selectedCreditLine: debouncedCreditLine,
    amount: debouncedAmount,
    confirmationAcknowledged: debouncedConfirmationAcknowledged,
    isOnConfirmStep: debouncedIsOnConfirmStep,
  });

  const previousRef = useRef<DrawWizardMicroStepState[] | null>(null);
  const announcementRef = useRef("");

  const announcement = buildMicroProgressAnnouncement(
    previousRef.current,
    settledSteps,
  );
  if (announcement) {
    announcementRef.current = announcement;
  }

  useEffect(() => {
    previousRef.current = settledSteps;
    // Re-baseline only once the debounced inputs actually settle, not on
    // every render — see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedCreditLine,
    debouncedAmount,
    debouncedConfirmationAcknowledged,
    debouncedIsOnConfirmStep,
  ]);

  return { steps, debouncedAnnouncement: announcementRef.current };
}
