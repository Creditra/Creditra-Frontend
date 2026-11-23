import { KycDrawer } from '../components/KycDrawer';

export interface KycProgressDrawerProps {
  /** Whether the KYC drawer is open. */
  isOpen: boolean;
  /** Called when the drawer requests close. */
  onClose: () => void;
  /** Called when the user resumes verification. */
  onResume: (stepId: string) => void;
  /** Current KYC verification step (0-indexed). */
  currentStep?: number;
  /** Total number of KYC steps. */
  totalSteps?: number;
}

/**
 * KycProgressDrawer — KYC progress page wrapper.
 *
 * Thin wrapper around `KycDrawer` that adds step-progress context.
 * Delegates all rendering and accessibility to the underlying `KycDrawer`
 * component. Exists as a named page-level entry point so routing and
 * documentation can reference it directly.
 *
 * WCAG 2.1 AA:
 * - All accessibility guarantees come from `KycDrawer`.
 * - The drawer respects `useFocusTrap`, `useBodyScrollLock`, and
 *   `useInertBackdrop` hooks.
 *
 * @see KycDrawer
 */
export function KycProgressDrawer({
  isOpen,
  onClose,
  onResume,
  currentStep: _currentStep = 0,
  totalSteps: _totalSteps = 3,
}: KycProgressDrawerProps) {
  return (
    <KycDrawer
      isOpen={isOpen}
      onClose={onClose}
      onResume={onResume}
    />
  );
}

export default KycProgressDrawer;
