import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttestationCard } from '../AttestationCard';
import type { Attestation } from '../../types/attestation';

const BASE_DATE = new Date('2026-07-01T00:00:00Z').getTime();

function makeAttestation(
  overrides: Partial<Attestation> & { id: string },
): Attestation {
  return {
    label: 'Test Attestation',
    lastVerifiedAt: new Date(BASE_DATE - 30 * 86_400_000).toISOString(),
    expiresAt: new Date(BASE_DATE + 150 * 86_400_000).toISOString(),
    remediationStep: 1,
    ...overrides,
  };
}

describe('AttestationCard — live region announcements', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with no announcement on initial mount', () => {
    const attestations = [makeAttestation({ id: 'a1', label: 'Identity Bond' })];
    render(<AttestationCard attestations={attestations} />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('');
  });

  it('announces when an attestation status changes', () => {
    const verified = makeAttestation({ id: 'a1', label: 'Identity Bond' });
    const { rerender } = render(<AttestationCard attestations={[verified]} />);

    const expiring = makeAttestation({
      id: 'a1',
      label: 'Identity Bond',
      expiresAt: new Date(BASE_DATE + 5 * 86_400_000).toISOString(),
    });
    rerender(<AttestationCard attestations={[expiring]} />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Identity Bond status changed to Expiring soon.');
  });

  it('does not announce when statuses are unchanged', () => {
    const att = makeAttestation({ id: 'a1', label: 'Identity Bond' });
    const { rerender } = render(<AttestationCard attestations={[att]} />);

    rerender(<AttestationCard attestations={[att]} />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('');
  });

  it('announces multiple status changes in a single message', () => {
    const a1 = makeAttestation({ id: 'a1', label: 'Identity Bond' });
    const a2 = makeAttestation({ id: 'a2', label: 'Revenue Proof' });
    const { rerender } = render(<AttestationCard attestations={[a1, a2]} />);

    const a1Expiring = makeAttestation({
      id: 'a1',
      label: 'Identity Bond',
      expiresAt: new Date(BASE_DATE + 5 * 86_400_000).toISOString(),
    });
    const a2Missing = makeAttestation({
      id: 'a2',
      label: 'Revenue Proof',
      lastVerifiedAt: undefined,
      expiresAt: undefined,
    });
    rerender(<AttestationCard attestations={[a1Expiring, a2Missing]} />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent(
      'Identity Bond status changed to Expiring soon. Revenue Proof status changed to Missing.',
    );
  });

  it('renders with polite aria-live and status role', () => {
    const attestations = [makeAttestation({ id: 'a1' })];
    render(<AttestationCard attestations={attestations} />);

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });
});
