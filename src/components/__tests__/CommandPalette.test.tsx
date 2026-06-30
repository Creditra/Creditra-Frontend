import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';

// Suppress DOM side-effects from hooks under test.
// Paths must match how CommandPalette.tsx resolves them (relative from src/hooks).
vi.mock('../../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('../../hooks/useInertBackdrop',  () => ({ useInertBackdrop:  vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function Wrapper({ isOpen = true, onClose = vi.fn() } = {}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <MemoryRouter>
      <button ref={triggerRef}>trigger</button>
      <CommandPalette isOpen={isOpen} onClose={onClose} triggerRef={triggerRef} />
    </MemoryRouter>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('renders when open', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<Wrapper isOpen={false} />);
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('shows default items', () => {
    render(<Wrapper />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Credit Lines')).toBeInTheDocument();
  });

  it('filters items on input', async () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'dash');
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    });
  });

  it('shows empty state for no matches', async () => {
    render(<Wrapper />);
    await userEvent.type(screen.getByRole('textbox'), 'xyznotfound');
    await waitFor(() => {
      expect(screen.getByText(/no results/i)).toBeInTheDocument();
    });
  });

  it('closes and navigates on item click', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    const btn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Dashboard'));
    expect(btn).toBeDefined();
    await userEvent.click(btn!);
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    fireEvent.click(document.querySelector('.cp-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Esc key', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('arrow keys move selection', async () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    // Initial: first item selected
    const firstItem = screen.getAllByRole('option')[0];
    expect(firstItem).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    const secondItem = screen.getAllByRole('option')[1];
    expect(secondItem).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(dialog, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter activates the selected item', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('has accessible dialog role and aria-modal', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label');
  });

  it('input has aria-controls pointing at listbox', () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    const listId = input.getAttribute('aria-controls');
    expect(listId).toBeTruthy();
    expect(document.getElementById(listId!)).toBeInTheDocument();
  });

  it('resets query when reopened', async () => {
    const { rerender } = render(<Wrapper isOpen={true} />);
    await userEvent.type(screen.getByRole('textbox'), 'dash');
    rerender(<Wrapper isOpen={false} />);
    rerender(<Wrapper isOpen={true} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('renders extra items alongside defaults', () => {
    const triggerRef = { current: null };
    render(
      <MemoryRouter>
        <CommandPalette
          isOpen
          onClose={vi.fn()}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
          extraItems={[{ id: 'x', label: 'My Custom Action', action: vi.fn() }]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('My Custom Action')).toBeInTheDocument();
  });
});
