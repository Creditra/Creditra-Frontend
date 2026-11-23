import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KycProgressDrawer } from './KycProgressDrawer';

// Mock KycDrawer to avoid importing its full dependency chain
vi.mock('../components/KycDrawer', () => ({
  KycDrawer: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onResume: (stepId: string) => void;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label="KYC drawer">
        <button onClick={onClose}>Close drawer</button>
      </div>
    ) : null,
}));

describe('KycProgressDrawer', () => {
  it('renders the KycDrawer when open', () => {
    render(
      <KycProgressDrawer
        isOpen
        onClose={vi.fn()}
        onResume={vi.fn()}
        currentStep={1}
        totalSteps={3}
      />,
    );
    const drawer = screen.getByRole('dialog');
    expect(drawer).toBeInTheDocument();
  });

  it('does not render when not open', () => {
    render(
      <KycProgressDrawer
        isOpen={false}
        onClose={vi.fn()}
        onResume={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('passes onClose to KycDrawer', () => {
    const onClose = vi.fn();
    render(
      <KycProgressDrawer isOpen onClose={onClose} onResume={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
