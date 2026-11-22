import { useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useKyc } from '../context/KycContext';
import type { KycStepId, KycStepStatus } from '../types/kyc';

const KYC_STEP_IDS: readonly KycStepId[] = [
  'identity',
  'address',
  'documents',
  'selfie',
  'review',
];

const STATUS_LABEL: Record<KycStepStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  pending: 'Under review',
};

function isValidKycStepId(value: string | null): value is KycStepId {
  return value !== null && (KYC_STEP_IDS as readonly string[]).includes(value);
}

export function KycPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { steps, resumeStepId, setStepStatus } = useKyc();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const requestedStep = searchParams.get('step');
  const activeStepId: KycStepId = isValidKycStepId(requestedStep)
    ? requestedStep
    : (resumeStepId ?? steps[0]?.id ?? 'identity');

  const activeStep = steps.find((s) => s.id === activeStepId) ?? steps[0];

  useEffect(() => {
    headingRef.current?.focus();
  }, [activeStepId, location.key]);

  if (!activeStep) {
    return null;
  }

  const isCompleted = activeStep.status === 'completed';

  return (
    <section className="kyc-page" aria-labelledby="kyc-page-heading">
      <header className="kyc-page__header">
        <p className="kyc-page__kicker">KYC Verification</p>
        <h1
          id="kyc-page-heading"
          ref={headingRef}
          tabIndex={-1}
          className="kyc-page__title"
        >
          {activeStep.label}
        </h1>
        <p className="kyc-page__description">{activeStep.description}</p>
        <p className="kyc-page__status" role="status">
          Status: <strong>{STATUS_LABEL[activeStep.status]}</strong>
        </p>
      </header>

      <div className="kyc-page__actions">
        <button
          type="button"
          className="kyc-page__complete-btn"
          disabled={isCompleted}
          onClick={() => setStepStatus(activeStep.id, 'completed')}
        >
          {isCompleted ? 'Step completed' : 'Mark step complete'}
        </button>
      </div>
    </section>
  );
}

export default KycPage;
