import { useState } from 'react';
import './OnboardingFlow.css';

interface Props {
  isOpen: boolean;
  onComplete: () => void;
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

  if (!isOpen) return null;

  const isLastStep = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const handleNext = () => {
    if (isLastStep) {
      localStorage.setItem('onboarding_completed', 'true');
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onSkip();
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-content">
        <button className="skip-btn" onClick={handleSkip}>Skip</button>
        
        <div className="onboarding-step">
          <div className="step-icon">{step.icon}</div>
          <h2>{step.title}</h2>
          <p>{step.description}</p>
        </div>

        <div className="step-indicators">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`indicator ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
            >
              {index < currentStep ? '✓' : index + 1}
            </div>
          ))}
        </div>

        <button className="primary-btn" onClick={handleNext}>
          {isLastStep ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  );
};
