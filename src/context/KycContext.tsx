/**
 * KycContext — app-wide KYC progress state.
 *
 * Owns the ordered step list and exposes helpers so the drawer and any
 * future KYC page can read/update status without prop-drilling.
 *
 * Persistence strategy:
 *   - Hydrated from `localStorage` on mount (key: `creditra_kyc`).
 *   - Written back on every status change.
 *   - Capped at version 1; migrations can be added to `migrateState`.
 *
 * Security note: localStorage is client-only and unverified. The source
 * of truth for KYC status is always the backend. This context is for
 * UI progress only; never gate security decisions on it alone.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type {
  KycOverallStatus,
  KycPersistedState,
  KycStep,
  KycStepId,
  KycStepStatus,
} from '../types/kyc';
import { KYC_STORAGE_KEY } from '../constants/storageKeys';
import { readVersioned, writeVersioned } from '../utils/storage';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const KYC_SCHEMA_VERSION = 1;

/** The canonical ordered step list. */
const DEFAULT_STEPS: KycStep[] = [
  {
    id: 'identity',
    label: 'Identity Verification',
    description: 'Confirm your legal name and date of birth.',
    status: 'not_started',
  },
  {
    id: 'address',
    label: 'Address Verification',
    description: 'Provide a current residential address.',
    status: 'not_started',
  },
  {
    id: 'documents',
    label: 'Document Upload',
    description: 'Upload a government-issued photo ID.',
    status: 'not_started',
  },
  {
    id: 'selfie',
    label: 'Selfie Check',
    description: 'Take a live selfie matching your ID photo.',
    status: 'not_started',
  },
  {
    id: 'review',
    label: 'Final Review',
    description: 'Our compliance team reviews your submission.',
    status: 'not_started',
  },
];

// ─── Context shape ────────────────────────────────────────────────────────────

interface KycContextValue {
  /** Ordered KYC steps with their current statuses. */
  steps: KycStep[];
  /** Derived overall status badge shown on the header trigger. */
  overallStatus: KycOverallStatus;
  /**
   * The step the "Resume" button should land on:
   * the first step that is `in_progress` or `not_started`.
   * `null` when all steps are completed/pending/failed.
   */
  resumeStepId: KycStepId | null;
  /**
   * Number of completed steps. Used for the progress fraction in the drawer.
   */
  completedCount: number;
  /** Update the status of a single step. */
  setStepStatus: (stepId: KycStepId, status: KycStepStatus) => void;
  /** Reset all steps back to `not_started`. Intended for testing/dev. */
  resetAll: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveOverallStatus(steps: KycStep[]): KycOverallStatus {
  const statuses = steps.map(s => s.status);
  if (statuses.every(s => s === 'not_started'))     return 'not_started';
  if (statuses.some(s => s === 'failed'))            return 'rejected';
  if (statuses.every(s => s === 'completed'))        return 'approved';
  if (statuses.every(s => s === 'completed' || s === 'pending')) return 'under_review';
  return 'in_progress';
}

function deriveResumeStepId(steps: KycStep[]): KycStepId | null {
  // Prefer the first in_progress step, then the first not_started step.
  const inProgress = steps.find(s => s.status === 'in_progress');
  if (inProgress) return inProgress.id;
  const notStarted = steps.find(s => s.status === 'not_started');
  return notStarted?.id ?? null;
}

function isKycPersistedState(data: unknown): data is KycPersistedState {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  return record.version === 1 && Array.isArray(record.steps);
}

function migrateKycState(raw: unknown, fromVersion: number): KycPersistedState | undefined {
  if (fromVersion === 0 && isKycPersistedState(raw)) {
    return raw;
  }
  return undefined;
}

function loadFromStorage(): KycStep[] {
  const parsed = readVersioned<KycPersistedState | null>(KYC_STORAGE_KEY, {
    version: KYC_SCHEMA_VERSION,
    fallback: null,
    migrate: migrateKycState,
    validate: isKycPersistedState,
  });

  if (!parsed) return DEFAULT_STEPS;

  // Merge stored statuses onto the canonical step list so new steps
  // added in code appear with their defaults.
  const stored = new Map(parsed.steps.map(s => [s.id, s]));
  return DEFAULT_STEPS.map(def => {
    const s = stored.get(def.id);
    return s ? { ...def, status: s.status, updatedAt: s.updatedAt } : def;
  });
}

function saveToStorage(steps: KycStep[]): void {
  const payload: KycPersistedState = {
    version: 1,
    steps,
    lastUpdated: new Date().toISOString(),
  };
  writeVersioned(KYC_STORAGE_KEY, payload, { version: KYC_SCHEMA_VERSION });
}

// ─── Context ──────────────────────────────────────────────────────────────────

const KycContext = createContext<KycContextValue | null>(null);

export function KycProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<KycStep[]>(() => loadFromStorage());

  // Persist on every change.
  useEffect(() => {
    saveToStorage(steps);
  }, [steps]);

  const setStepStatus = useCallback(
    (stepId: KycStepId, status: KycStepStatus) => {
      setSteps(prev =>
        prev.map(s =>
          s.id === stepId
            ? { ...s, status, updatedAt: new Date().toISOString() }
            : s
        )
      );
    },
    []
  );

  const resetAll = useCallback(() => {
    setSteps(DEFAULT_STEPS.map(s => ({ ...s, updatedAt: undefined })));
  }, []);

  const overallStatus  = deriveOverallStatus(steps);
  const resumeStepId   = deriveResumeStepId(steps);
  const completedCount = steps.filter(s => s.status === 'completed').length;

  return (
    <KycContext.Provider
      value={{ steps, overallStatus, resumeStepId, completedCount, setStepStatus, resetAll }}
    >
      {children}
    </KycContext.Provider>
  );
}

/**
 * Read the KYC context. Throws outside KycProvider to surface misuse early.
 */
export function useKyc() {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error('useKyc must be used within a KycProvider');
  return ctx;
}
