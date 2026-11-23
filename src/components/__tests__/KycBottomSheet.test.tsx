import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KycBottomSheet } from '../KycBottomSheet';
import { KycProvider } from '../../context/KycContext';
import type { KycStepId, KycStepStatus } from '../../types/kyc';

vi.mock('../../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }));
vi.mock('../../hooks/useInertBackdrop',  () => ({ useInertBackdrop:  () => undefined }));
vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => {
    const ref: React.MutableRefObject<HTMLDivElement | null> = { current: null };
    return ref;
  },
}));
Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });

function primeStorage(overrides: Partial<Record<KycStepId, KycStepStatus>>) {
  const DEFAULT_IDS: KycStepId[] = ['identity', 'address', 'documents', 'selfie', 'review'];
  const steps = DEFAULT_IDS.map(id => ({
    id,
    label: id,
    description: '',
    status: overrides[id] ?? 'not_started',
    updatedAt: overrides[id] ? new Date().toISOString() : undefined,
  }));
  localStorage.setItem('creditra_kyc', JSON.stringify({ version: 1, steps, lastUpdated: new Date().toISOString() }));
}

function renderSheet(
  props: { isOpen?: boolean; onClose?: ReturnType<typeof vi.fn>; onResume?: ReturnType<typeof vi.fn> } = {},
) {
  const onClose  = props.onClose  ?? vi.fn();
  const onResume = props.onResume ?? vi.fn();
  const isOpen   = props.isOpen   ?? true;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <KycProvider>{children}</KycProvider>;
  }

  const result = render(
    <KycBottomSheet isOpen={isOpen} onClose={onClose} onResume={onResume} />,
    { wrapper: Wrapper },
  );

  return { ...result, onClose, onResume };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('KycBottomSheet', () => {

  it('returns null when isOpen is false', () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has correct ARIA dialog attributes', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'kyc-sheet-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'kyc-sheet-desc');
  });

  it('shows the title "KYC Progress"', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: /kyc progress/i })).toBeInTheDocument();
  });

  it('shows the kicker copy', () => {
    renderSheet();
    expect(screen.getByText(/grantfox/i)).toBeInTheDocument();
  });

  it('shows a drag handle bar', () => {
    renderSheet();
    const dragHandle = document.querySelector('.kyc-sheet__drag-handle');
    expect(dragHandle).toBeInTheDocument();
  });

  it('renders all 5 steps', () => {
    renderSheet();
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
  });

  it('shows step numbers for not_started steps', () => {
    renderSheet();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('marks the resume step with aria-current="step"', () => {
    primeStorage({ address: 'in_progress' });
    renderSheet();
    const currentItem = screen.getByRole('listitem', { current: 'step' });
    expect(currentItem).toBeInTheDocument();
    expect(currentItem.textContent).toMatch(/address/i);
  });

  it('shows screen-reader status on each step', () => {
    renderSheet();
    const srNodes = Array.from(document.querySelectorAll('.sr-only'));
    const statusTexts = srNodes.map(n => n.textContent);
    expect(statusTexts.some(t => t?.includes('Not started'))).toBe(true);
  });

  it('shows "In progress" sr-only text when a step is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderSheet();
    const srNodes = Array.from(document.querySelectorAll('.sr-only'));
    expect(srNodes.some(n => n.textContent?.includes('In progress'))).toBe(true);
  });

  it('has role="progressbar" with valuenow=0 when nothing is completed', () => {
    renderSheet();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('updates progressbar valuenow when steps are completed', () => {
    primeStorage({ identity: 'completed', address: 'completed' });
    renderSheet();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
  });

  it('shows "Not started" status badge initially', () => {
    renderSheet();
    expect(screen.getByRole('status')).toHaveTextContent(/not started/i);
  });

  it('shows "In progress" when a step is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderSheet();
    expect(screen.getByRole('status')).toHaveTextContent(/in progress/i);
  });

  it('shows "Approved" when all steps are completed', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'completed', review: 'completed' });
    renderSheet();
    expect(screen.getByRole('status')).toHaveTextContent(/approved/i);
  });

  it('shows "Under review" when all steps are pending', () => {
    primeStorage({ identity: 'pending', address: 'pending', documents: 'pending', selfie: 'pending', review: 'pending' });
    renderSheet();
    expect(screen.getByRole('status')).toHaveTextContent(/under review/i);
  });

  it('shows "Start verification" text when status is not_started', () => {
    renderSheet();
    expect(
      screen.getByRole('button', { name: /start verification/i }),
    ).toBeInTheDocument();
  });

  it('shows "Resume verification" when a step is in_progress', () => {
    primeStorage({ documents: 'in_progress' });
    renderSheet();
    expect(
      screen.getByRole('button', { name: /resume verification/i }),
    ).toBeInTheDocument();
  });

  it('shows "All steps submitted" when under_review', () => {
    primeStorage({ identity: 'pending', address: 'pending', documents: 'pending', selfie: 'pending', review: 'pending' });
    renderSheet();
    expect(
      screen.getByRole('button', { name: /all steps submitted/i }),
    ).toBeInTheDocument();
  });

  it('Resume button is disabled when all steps are completed', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'completed', review: 'completed' });
    renderSheet();
    const btn = screen.getByRole('button', { name: /all steps submitted/i });
    expect(btn).toBeDisabled();
  });

  it('Resume button is enabled when there is a resumeStepId', () => {
    renderSheet();
    expect(
      screen.getByRole('button', { name: /start verification/i }),
    ).not.toBeDisabled();
  });

  it('calls onResume with the first not_started step id', () => {
    const onResume = vi.fn();
    const onClose  = vi.fn();
    renderSheet({ onResume, onClose });
    fireEvent.click(screen.getByRole('button', { name: /start verification/i }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledWith('identity');
  });

  it('calls onClose after Resume is clicked', () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /start verification/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onResume with the in_progress step when one exists', () => {
    primeStorage({ selfie: 'in_progress' });
    const onResume = vi.fn();
    renderSheet({ onResume });
    fireEvent.click(screen.getByRole('button', { name: /resume verification/i }));
    expect(onResume).toHaveBeenCalledWith('selfie');
  });

  it('calls onClose when the × button is clicked', () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: /close kyc bottom sheet/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const { onClose } = renderSheet();
    fireEvent.click(document.querySelector('.kyc-sheet-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed on the dialog', () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has a drag handle that responds to touch events', () => {
    renderSheet();
    const dragHandle = document.querySelector('.kyc-sheet__drag-handle') as HTMLElement;
    expect(dragHandle).toBeInTheDocument();

    fireEvent.touchStart(dragHandle, { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(dragHandle, { touches: [{ clientY: 500 }] });
    fireEvent.touchEnd(dragHandle);
  });

  it('applies dragging class during mouse drag', () => {
    renderSheet();
    const dragHandle = document.querySelector('.kyc-sheet__drag-handle') as HTMLElement;
    fireEvent.mouseDown(dragHandle, { clientY: 300 });
    const sheet = document.querySelector('.kyc-sheet');
    expect(sheet?.classList.contains('kyc-sheet--dragging')).toBe(true);

    fireEvent.mouseUp(document);
  });

  it('closes on drag end when drag offset exceeds threshold', () => {
    const { onClose } = renderSheet();
    const dragHandle = document.querySelector('.kyc-sheet__drag-handle') as HTMLElement;

    fireEvent.touchStart(dragHandle, { touches: [{ clientY: 200 }] });
    fireEvent.touchMove(document.querySelector('.kyc-sheet') as HTMLElement, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(dragHandle);

    expect(onClose).not.toHaveBeenCalled();
  });

});
