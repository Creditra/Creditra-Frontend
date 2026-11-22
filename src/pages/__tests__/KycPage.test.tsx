import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { KycProvider } from '../../context/KycContext';
import { KycPage } from '../KycPage';
import type { KycStepId, KycStepStatus } from '../../types/kyc';

function primeKycStorage(overrides: Partial<Record<KycStepId, KycStepStatus>>) {
  const ids: KycStepId[] = ['identity', 'address', 'documents', 'selfie', 'review'];
  const steps = ids.map((id) => ({
    id,
    label: id,
    description: '',
    status: overrides[id] ?? 'not_started',
    updatedAt: overrides[id] ? new Date().toISOString() : undefined,
  }));
  localStorage.setItem(
    'creditra_kyc',
    JSON.stringify({ version: 1, steps, lastUpdated: new Date().toISOString() }),
  );
}

function renderKycPage(initialEntry: string) {
  return render(
    <KycProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/kyc" element={<KycPage />} />
        </Routes>
      </MemoryRouter>
    </KycProvider>,
  );
}

describe('KycPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the requested valid step from ?step= and focuses the heading', () => {
    renderKycPage('/kyc?step=documents');

    const heading = screen.getByRole('heading', { level: 1, name: 'Document Upload' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(screen.getByText('Upload a government-issued photo ID.')).toBeInTheDocument();
  });

  it('falls back to resumeStepId when ?step= is invalid', () => {
    primeKycStorage({ identity: 'completed', address: 'in_progress' });
    renderKycPage('/kyc?step=invalid-step-id');

    const heading = screen.getByRole('heading', { level: 1, name: 'Address Verification' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(screen.getByText('Provide a current residential address.')).toBeInTheDocument();
  });

  it('falls back to resumeStepId when ?step= is omitted', () => {
    primeKycStorage({ identity: 'completed' });
    renderKycPage('/kyc');

    const heading = screen.getByRole('heading', { level: 1, name: 'Address Verification' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
  });

  it('updates step status via setStepStatus when marking progress', () => {
    renderKycPage('/kyc?step=identity');

    const button = screen.getByRole('button', { name: 'Mark step complete' });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(screen.getByRole('status')).toHaveTextContent('Completed');
    expect(screen.getByRole('button', { name: 'Step completed' })).toBeDisabled();
  });
});
