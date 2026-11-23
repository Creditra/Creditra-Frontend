import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AttestationCard } from './AttestationCard';
import './AttestationCard.css';

function renderCard(props: React.ComponentProps<typeof AttestationCard>) {
  return render(
    <MemoryRouter>
      <AttestationCard {...props} />
    </MemoryRouter>,
  );
}

describe('AttestationCard', () => {
  it('renders title and description', () => {
    renderCard({
      title: 'Identity Verified',
      description: 'Your KYC attestation is complete.',
    });
    expect(screen.getByText('Identity Verified')).toBeInTheDocument();
    expect(
      screen.getByText('Your KYC attestation is complete.'),
    ).toBeInTheDocument();
  });

  it('renders breadcrumbs when provided', () => {
    renderCard({
      title: 'Attestation',
      description: 'Details.',
      breadcrumbs: [{ label: 'Home', to: '/' }, { label: 'Attest' }],
    });
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Attest')).toBeInTheDocument();
  });

  it('does not render breadcrumb nav when no breadcrumbs', () => {
    renderCard({
      title: 'Test',
      description: 'No crumbs.',
    });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('has accessible heading', () => {
    renderCard({ title: 'Test', description: 'Body' });
    expect(
      screen.getByRole('heading', { name: 'Test' }),
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with long labels without overflow', () => {
    const longLabel = 'A'.repeat(100);
    renderCard({
      title: 'Attestation',
      description: 'Details.',
      breadcrumbs: [
        { label: 'Home', to: '/' },
        { label: 'Dashboard', to: '/dashboard' },
        { label: longLabel },
      ],
    });
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    const truncated = nav.querySelector('.breadcrumb__label--current');
    expect(truncated).toBeInTheDocument();
  });

  it('triggers middle-ellipsis with many breadcrumb items', () => {
    renderCard({
      title: 'Attestation',
      description: 'Details.',
      breadcrumbs: [
        { label: 'Root', to: '/' },
        { label: 'Section A', to: '/a' },
        { label: 'Section B', to: '/b' },
        { label: 'Section C', to: '/c' },
        { label: 'Section D', to: '/d' },
        { label: 'Target' },
      ],
    });
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Section D')).toBeInTheDocument();
    expect(screen.getByText('Target')).toBeInTheDocument();
    expect(screen.queryByText('Section A')).not.toBeInTheDocument();
    expect(screen.queryByText('Section B')).not.toBeInTheDocument();
    expect(screen.queryByText('Section C')).not.toBeInTheDocument();
  });

  it('breadcrumb container does not exceed card width', () => {
    renderCard({
      title: 'Attestation',
      description: 'Details.',
      breadcrumbs: [
        { label: 'X'.repeat(50), to: '/' },
        { label: 'Y'.repeat(50), to: '/y' },
        { label: 'Z'.repeat(50) },
      ],
    });
    const nav = screen.getByRole('navigation');
    const card = nav.closest('.card');
    expect(card).toBeInTheDocument();
  });
});
