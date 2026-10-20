import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AttestationCard } from './AttestationCard';
import type { Attestation } from '../types/attestation';
import '@testing-library/jest-dom/vitest';

describe('AttestationCard accessibility', () => {
  it('announces status changes via aria-live region when attestations prop updates', () => {
    // Starting with an expiring attestation
    const initialAttestations: Attestation[] = [
      {
        id: 'att-1',
        label: 'Identity Bond',
        lastVerifiedAt: '2023-01-01T00:00:00Z',
        expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(), // 5 days from now (Expiring)
        remediationStep: 1,
      },
    ];

    const { rerender, container } = render(
      <BrowserRouter>
        <AttestationCard attestations={initialAttestations} />
      </BrowserRouter>
    );

    const liveRegion = container.querySelector('.sr-only[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    // Initial render shouldn't announce status changes loudly
    expect(liveRegion?.textContent).toBe('');

    // Update to Verified (e.g. user renewed it, expires far in the future)
    const updatedAttestations: Attestation[] = [
      {
        id: 'att-1',
        label: 'Identity Bond',
        lastVerifiedAt: '2023-01-01T00:00:00Z',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), // 30 days from now (Verified)
        remediationStep: 1,
      },
    ];

    rerender(
      <BrowserRouter>
        <AttestationCard attestations={updatedAttestations} />
      </BrowserRouter>
    );

    // Should announce the change
    expect(liveRegion?.textContent).toBe('Identity Bond status changed to Verified');
  });
});
