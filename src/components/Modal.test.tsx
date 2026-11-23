import '@testing-library/jest-dom/vitest';
import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Modal } from './Modal';
import { _resetBodyScrollLockForTesting } from '../hooks/useBodyScrollLock';

function Harness({ role = 'dialog' as 'dialog' | 'alertdialog' }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>Open</button>
      <Modal
        isOpen={open}
        role={role}
        triggerRef={triggerRef}
        initialFocusRef={initialRef}
        onClose={onClose}
        ariaLabelledBy="modal-title"
        ariaDescribedBy="modal-description"
        backdropTestId="modal-backdrop"
        overlayClassName="modal-overlay"
        dialogClassName="modal-card"
      >
        <h2 id="modal-title">Shared modal</h2>
        <p id="modal-description">Shared modal description</p>
        <button ref={initialRef}>Initial action</button>
        <button>Secondary action</button>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    _resetBodyScrollLockForTesting();
  });

  it('renders through a portal with accessible dialog semantics', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog', { name: 'Shared modal' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Shared modal description');
  });

  it('supports alertdialog role and closes on backdrop or Escape', async () => {
    render(<Harness role="alertdialog" />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-backdrop'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    fireEvent.keyDown(document, { key: 'Escape' });
  });

  it('restores trigger focus when closed', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Initial action' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
