import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { Tooltip } from './Tooltip';
import './OnboardingFlow.css';

interface Props {
  /** Whether the onboarding modal is visible. */
  isOpen: boolean;
  /**
   * Invoked after the final step. The component writes
   * `localStorage.onboarding_completed = 'true'` before calling this so
   * returning users skip the flow on subsequent connects.
   */
  onComplete: () => void;
  /**
   * Invoked when the user opts out via the Skip affordance. Skipping
   * does NOT mark onboarding as complete — the next session will see
   * the flow again, which is intentional. The trade-off is documented
   * in `docs/UX_RATIONALE.md` "Single onboarding stepper, not separate
   * modals".
   */
  onSkip: () => void;
}

const steps = [
  {
    title: 'Welcome to Creditra',
    description: 'Your adaptive credit protocol on Stellar blockchain',
    icon: '👋'
  },
  {
    title: 'Credit Evaluation',
    description: 'We analyze your on-chain activity to determine your credit limit and terms',
    icon: '📊'
  },
  {
    title: 'Flexible Credit Lines',
    description: 'Draw and repay credit as needed with dynamic interest rates based on your risk profile',
    icon: '💳'
  }
];

export const OnboardingFlow = ({ isOpen, onComplete, onSkip }: Props) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setDirection('forward');
    }
  }, [isOpen]);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const step = steps[currentStep];

  const handleNext = useCallback(() => {
    setDirection('forward');
    setCurrentStep((current) => {
      if (current === steps.length - 1) {
        localStorage.setItem('onboarding_completed', 'true');
        onComplete();
        return current;
      }

      return current + 1;
    });
  }, [onComplete]);

  const handleBack = useCallback(() => {
    setDirection('backward');
    setCurrentStep((current) => Math.max(0, current - 1));
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem('onboarding_completed', 'true');
    onSkip();
  }, [onSkip]);

  const handleSelectStep = useCallback((index: number) => {
    setDirection(index > currentStep ? 'forward' : 'backward');
    setCurrentStep(index);
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSkip();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleNext();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleBack();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleBack, handleNext, handleSkip, isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Onboarding">
      <div className="onboarding-content">
        <Tooltip label="Skip onboarding flow" position="bottom" hoverDelay={400} longPressDelay={500}>
          <button type="button" className="skip-btn" onClick={handleSkip} aria-label="Skip onboarding">
            <span className="skip-icon" aria-hidden="true">✕</span>
            <span className="skip-text">Skip</span>
          </button>
        </Tooltip>

        <div className="progress-label" aria-live="polite">
          Step {currentStep + 1} of {steps.length}
        </div>

        <div className="step-container">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              className="onboarding-step"
              initial={
                prefersReducedMotion
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: direction === 'forward' ? 20 : -20 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 1, x: 0 }
                  : { opacity: 0, x: direction === 'forward' ? -20 : 20 }
              }
              transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
            >
              <div className="step-icon">{step.icon}</div>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="step-indicators" role="list">
          {steps.map((s, index) => (
            <div key={index} role="listitem">
              <Tooltip label={`Step ${index + 1}: ${s.title}`} position="top" hoverDelay={400} longPressDelay={500}>
                <button
                  type="button"
                  className={`indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                  onClick={() => handleSelectStep(index)}
                  aria-current={index === currentStep ? 'step' : undefined}
                  aria-label={`Step ${index + 1}`}
                >
                  {index < currentStep ? '✓' : index + 1}
                </button>
              </Tooltip>
            </div>
          ))}
        </div>

        <div className="button-group">
          <Tooltip label="Go to previous step" position="top" hoverDelay={400} longPressDelay={500} disabled={isFirstStep}>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleBack}
              disabled={isFirstStep}
              aria-label="Go back"
            >
              Back
            </button>
          </Tooltip>
          <Tooltip label={isLastStep ? 'Complete onboarding' : 'Go to next step'} position="top" hoverDelay={400} longPressDelay={500}>
            <button
              type="button"
              className="primary-btn"
              onClick={handleNext}
              aria-label={isLastStep ? 'Get started' : 'Next step'}
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
