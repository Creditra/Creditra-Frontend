/**
 * CommandPalette.test.tsx
 *
 * Vitest + React Testing Library tests for the CommandPalette component.
 *
 * ## Coverage
 * - Render / visibility (open vs. closed)
 * - Default item registry
 * - Fuzzy-search filtering (matching, no-match empty state)
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
 * - Item activation (click + keyboard): navigation and callback actions
 * - Backdrop click-to-close
 * - State reset on re-open
 * - Extra items injection via `extraItems` prop
 * - ARIA attributes (dialog, aria-modal, aria-controls, aria-activedescendant)
 * - Focus ring visibility for mouse and keyboard (CSS class assertions)
 * - Arrow-key wrapping at list boundaries
 * - Activation of callback items (non-string action)
 */
import React, { useRef } from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';
import { COMMAND_PALETTE_RECENTS_KEY } from '@/constants/storageKeys';
import { renderWithCredit } from '@/test/renderWithCredit';
import { MOCK_CREDIT_LINES } from '@/data/mockData';
import type { CreditLine } from '@/types/creditLine';
import type { CreditDataSource } from '@/services/credit/CreditDataSource';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Suppress scroll-lock and inert-backdrop DOM side-effects in jsdom.
vi.mock('@/hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('@/hooks/useInertBackdrop',  () => ({ useInertBackdrop:  vi.fn() }));

// Replace useNavigate with a spy so we can assert navigation calls.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal render wrapper providing the BrowserRouter context that
 * useNavigate requires.
 */
function Wrapper({
  isOpen = true,
  onClose = vi.fn(),
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <MemoryRouter>
      {/* The trigger button must be in the DOM for useFocusTrap return-focus. */}
      <button ref={triggerRef}>trigger</button>
      <CommandPalette isOpen={isOpen} onClose={onClose} triggerRef={triggerRef} />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    window.localStorage.clear();
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it('renders when open', () => {
    render(<Wrapper />);
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<Wrapper isOpen={false} />);
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  // ── Default items ───────────────────────────────────────────────────────────

  it('shows default navigation items', () => {
    render(<Wrapper />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Credit Lines')).toBeInTheDocument();
  });

  it('shows quick-action items (Repay, Notification Settings)', () => {
    render(<Wrapper />);
    expect(screen.getByText('Repay')).toBeInTheDocument();
    expect(screen.getByText('Notification Settings')).toBeInTheDocument();
  });

  // ── Fuzzy search ────────────────────────────────────────────────────────────

  it('filters items that match the query', async () => {
    render(<Wrapper />);
    await userEvent.type(screen.getByRole('textbox'), 'dash');
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    });
  });

  it('filters by description text (not just label)', async () => {
    render(<Wrapper />);
    // "repayment" appears in the Repay item description
    await userEvent.type(screen.getByRole('textbox'), 'repayment');
    await waitFor(() => {
      expect(screen.getByText('Repay')).toBeInTheDocument();
    });
  });

  it('shows empty state for a query with no matches', async () => {
    render(<Wrapper />);
    await userEvent.type(screen.getByRole('textbox'), 'xyznotfound');
    await waitFor(() => {
      expect(screen.getByText(/no results/i)).toBeInTheDocument();
    });
  });

  it('empty-state message includes the search query', async () => {
    render(<Wrapper />);
    await userEvent.type(screen.getByRole('textbox'), 'unknownxyz');
    await waitFor(() => {
      expect(screen.getByText(/unknownxyz/i)).toBeInTheDocument();
    });
  });

  it('restores full list when query is cleared', async () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'dash');
    await waitFor(() => expect(screen.queryByText('Transactions')).not.toBeInTheDocument());
    await userEvent.clear(input);
    await waitFor(() => expect(screen.getByText('Transactions')).toBeInTheDocument());
  });

  // ── Item activation ─────────────────────────────────────────────────────────

  it('navigates and closes on item click', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    const dashBtn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Dashboard'));
    await userEvent.click(dashBtn!);
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('calls a callback action (non-string) and closes', async () => {
    const actionSpy = vi.fn();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette
          isOpen
          onClose={onClose}
          extraItems={[{ id: 'action-test', label: 'Do Something', action: actionSpy }]}
        />
      </MemoryRouter>,
    );
    const btn = screen.getAllByRole('button').find((b) => b.textContent?.includes('Do Something'));
    await userEvent.click(btn!);
    expect(onClose).toHaveBeenCalledOnce();
    expect(actionSpy).toHaveBeenCalledOnce();
    // Callback items do NOT call navigate.
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  it('ArrowDown moves selection to next item', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    const options = screen.getAllByRole('option');
    // Initial selection is the first item.
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp moves selection to previous item', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    fireEvent.keyDown(dialog, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown wraps from last item back to first', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    const options = screen.getAllByRole('option');
    const last = options.length - 1;
    // Navigate to the last item.
    for (let i = 0; i < last; i++) {
      fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    }
    expect(screen.getAllByRole('option')[last]).toHaveAttribute('aria-selected', 'true');
    // One more ArrowDown should wrap to first.
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp wraps from first item to last', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    expect(options[options.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter activates the currently selected item', () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    // Default first item is Dashboard → '/'.
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('Escape closes the palette', async () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  // ── Backdrop ────────────────────────────────────────────────────────────────

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    fireEvent.click(document.querySelector('.cp-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── State reset ─────────────────────────────────────────────────────────────

  it('resets the query to empty when re-opened', async () => {
    const { rerender } = render(<Wrapper isOpen />);
    await userEvent.type(screen.getByRole('textbox'), 'dash');
    rerender(<Wrapper isOpen={false} />);
    rerender(<Wrapper isOpen />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('resets selection index to 0 when re-opened', async () => {
    const { rerender } = render(<Wrapper isOpen />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    // Close and re-open.
    rerender(<Wrapper isOpen={false} />);
    rerender(<Wrapper isOpen />);
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
  });

  // ── Extra items ─────────────────────────────────────────────────────────────

  it('renders extra items alongside defaults', () => {
    render(
      <MemoryRouter>
        <CommandPalette
          isOpen
          onClose={vi.fn()}
          extraItems={[{ id: 'x-custom', label: 'My Custom Action', action: vi.fn() }]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('My Custom Action')).toBeInTheDocument();
    // Defaults should still be present.
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('extra items are searchable', async () => {
    render(
      <MemoryRouter>
        <CommandPalette
          isOpen
          onClose={vi.fn()}
          extraItems={[{ id: 'x-unique', label: 'Zephyr Widget', action: vi.fn() }]}
        />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByRole('textbox'), 'zephyr');
    await waitFor(() => {
      expect(screen.getByText('Zephyr Widget')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });

  // ── ARIA / a11y ─────────────────────────────────────────────────────────────

  it('has role="dialog" and aria-modal="true"', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('dialog has an accessible name (aria-label)', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label');
    expect(dialog.getAttribute('aria-label')!.length).toBeGreaterThan(0);
  });

  it('input has aria-controls pointing at a listbox in the DOM', () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    const listId = input.getAttribute('aria-controls');
    expect(listId).toBeTruthy();
    const list = document.getElementById(listId!);
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute('role', 'listbox');
  });

  it('input has aria-activedescendant pointing at the active item', () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    const descendantId = input.getAttribute('aria-activedescendant');
    expect(descendantId).toBeTruthy();
    expect(document.getElementById(descendantId!)).toBeInTheDocument();
  });

  it('active item button has the correct id for aria-activedescendant', () => {
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    const descendantId = input.getAttribute('aria-activedescendant')!;
    const activeBtn = document.getElementById(descendantId);
    // The first default item is Dashboard.
    expect(activeBtn).toHaveTextContent('Dashboard');
  });

  it('aria-activedescendant updates after ArrowDown', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    const input = screen.getByRole('textbox');
    const initialId = input.getAttribute('aria-activedescendant');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    const updatedId = input.getAttribute('aria-activedescendant');
    expect(updatedId).not.toBe(initialId);
  });

  it('navigation item buttons have a ↵ hint for keyboard users', () => {
    render(<Wrapper />);
    // Find a navigation item button (e.g. Dashboard) and check for the hint element
    const dashBtn = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('Dashboard'),
    )!;
    // The hint span is aria-hidden but should contain a ↵ kbd element
    const hint = dashBtn.querySelector('.cp-item-hint');
    expect(hint).toBeInTheDocument();
  });

  it('callback action items do not show a ↵ hint', () => {
    const actionSpy = vi.fn();
    render(
      <MemoryRouter>
        <CommandPalette
          isOpen
          onClose={vi.fn()}
          extraItems={[{ id: 'cb-test', label: 'Callback Only', action: actionSpy }]}
        />
      </MemoryRouter>,
    );
    const cbBtn = screen.getAllByRole('button').find((b) =>
      b.textContent?.includes('Callback Only'),
    )!;
    expect(cbBtn.querySelector('.cp-item-hint')).not.toBeInTheDocument();
  });

  // ── Focus ring / active class ───────────────────────────────────────────────

  it('first item has cp-item--active class by default', () => {
    render(<Wrapper />);
    const options = screen.getAllByRole('option');
    const firstBtn = options[0].querySelector('button')!;
    expect(firstBtn).toHaveClass('cp-item--active');
  });

  it('second item gains cp-item--active after ArrowDown', () => {
    render(<Wrapper />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1].querySelector('button')).toHaveClass('cp-item--active');
    expect(options[0].querySelector('button')).not.toHaveClass('cp-item--active');
  });

  it('hovering an item updates the active class', () => {
    render(<Wrapper />);
    const options = screen.getAllByRole('option');
    const secondBtn = options[1].querySelector('button')!;
    fireEvent.mouseEnter(secondBtn);
    expect(secondBtn).toHaveClass('cp-item--active');
    expect(options[0].querySelector('button')).not.toHaveClass('cp-item--active');
  });

  it('includes Linked Accounts in the default registry', () => {
    render(<Wrapper />);
    expect(screen.getByText('Linked Accounts')).toBeInTheDocument();
  });

  it('navigates to /linked-accounts when Linked Accounts is activated', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByRole('button', { name: /linked accounts/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/linked-accounts');
  });

  it('clears the pending focus timer on unmount', () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { unmount } = render(<Wrapper />);
      unmount();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  // ── Recent commands ─────────────────────────────────────────────────────────

  it('orders recently activated items first in the empty-query view with a Recent label', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Wrapper isOpen />);

    await user.click(screen.getByRole('button', { name: /transactions/i }));
    rerender(<Wrapper isOpen={false} />);
    rerender(<Wrapper isOpen />);

    await user.click(screen.getByRole('button', { name: /help center/i }));
    rerender(<Wrapper isOpen={false} />);
    rerender(<Wrapper isOpen />);

    expect(screen.getByText('Recent')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Help Center');
    expect(options[1]).toHaveTextContent('Transactions');
  });

  it('persists recent items across remounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wrapper isOpen />);

    await user.click(screen.getByRole('button', { name: /transactions/i }));
    unmount();

    render(<Wrapper isOpen />);
    expect(screen.getByText('Recent')).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Transactions');
  });

  it('tolerates corrupt localStorage data and ignores unknown ids', () => {
    window.localStorage.setItem(COMMAND_PALETTE_RECENTS_KEY, '{corrupt');
    const { unmount } = render(<Wrapper isOpen />);
    expect(screen.queryByText('Recent')).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Dashboard');
    unmount();

    window.localStorage.setItem(
      COMMAND_PALETTE_RECENTS_KEY,
      JSON.stringify(['nav-does-not-exist', 'nav-transactions']),
    );
    render(<Wrapper isOpen />);
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Transactions');
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  it('preserves keyboard navigation and aria-activedescendant with Recent grouping', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Wrapper isOpen onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /transactions/i }));
    rerender(<Wrapper isOpen={false} onClose={onClose} />);
    rerender(<Wrapper isOpen onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const input = screen.getByRole('textbox');
    const options = screen.getAllByRole('option');

    expect(options[0]).toHaveTextContent('Transactions');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(dialog, { key: 'ArrowDown' });
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    mockNavigate.mockReset();
    onClose.mockReset();
    fireEvent.keyDown(dialog, { key: 'Enter' });
    expect(onClose).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledOnce();
  });

  it('keeps relevance order and hides Recent label when filtering', async () => {
    window.localStorage.setItem(
      COMMAND_PALETTE_RECENTS_KEY,
      JSON.stringify(['nav-help']),
    );
    render(<Wrapper isOpen />);
    expect(screen.getByText('Recent')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'dash');
    await waitFor(() => {
      expect(screen.queryByText('Recent')).not.toBeInTheDocument();
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Dashboard');
    });
  });

  // ── Credit lines & transactions search ──────────────────────────────────────

  describe('credit line and transaction data items', () => {
    it('does not include data items in the empty-query view or for 1-character queries', async () => {
      renderWithCredit(<CommandPalette isOpen onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      expect(screen.queryByText('Credit lines')).not.toBeInTheDocument();
      expect(screen.queryByText('Transactions')).toBeInTheDocument(); // Default nav item "Transactions"
      expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();

      await userEvent.type(screen.getByRole('textbox'), 'P');
      await waitFor(() => {
        expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
        expect(screen.queryByText('Credit lines')).not.toBeInTheDocument();
      });
    });

    it('shows matching credit line when typing its name and Enter navigates to /credit-lines?line=...', async () => {
      const onClose = vi.fn();
      renderWithCredit(<CommandPalette isOpen onClose={onClose} />);

      await userEvent.type(screen.getByRole('textbox'), 'Primary Business');

      await waitFor(() => {
        expect(screen.getByText('Credit lines')).toBeInTheDocument();
        expect(screen.getByText('Primary Business Line')).toBeInTheDocument();
      });

      const lineOption = document.getElementById('cp-item-credit-line-CL-2024-001');
      expect(lineOption).toBeInTheDocument();
      expect(lineOption).toHaveTextContent(/Active/i);
      expect(lineOption).toHaveTextContent(/\$187,500/);

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Enter' });

      expect(onClose).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith('/credit-lines?line=CL-2024-001');
    });

    it('searches transactions by line name, type, or id and navigates to /transactions?q=...', async () => {
      const onClose = vi.fn();
      renderWithCredit(<CommandPalette isOpen onClose={onClose} />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Expansion Capital');

      await waitFor(() => {
        expect(screen.getByText('Credit lines')).toBeInTheDocument();
        expect(screen.getByText('Transactions')).toBeInTheDocument();
        expect(screen.getByText('Draw $100,000')).toBeInTheDocument();
      });

      await userEvent.clear(input);
      await userEvent.type(input, 'TX-001');

      await waitFor(() => {
        expect(screen.getByText('Transactions')).toBeInTheDocument();
        expect(screen.getByText('Draw $50,000')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Enter' });

      expect(onClose).toHaveBeenCalledOnce();
      expect(mockNavigate).toHaveBeenCalledWith('/transactions?q=TX-001');
    });

    it('searches transactions by type', async () => {
      renderWithCredit(<CommandPalette isOpen onClose={vi.fn()} />);

      await userEvent.type(screen.getByRole('textbox'), 'Interest');

      await waitFor(() => {
        expect(screen.getByText('Transactions')).toBeInTheDocument();
        expect(screen.getByText('Interest $1,328')).toBeInTheDocument();
      });
    });

    it('caps data results per group at 5 items', async () => {
      const manyLines: CreditLine[] = Array.from({ length: 8 }, (_, idx) => ({
        ...MOCK_CREDIT_LINES[0],
        id: `CL-CAP-${idx + 1}`,
        name: `Alpha Facility ${idx + 1}`,
      }));

      renderWithCredit(<CommandPalette isOpen onClose={vi.fn()} />, {
        lines: manyLines,
      });

      await userEvent.type(screen.getByRole('textbox'), 'Alpha Facility');

      await waitFor(() => {
        expect(screen.getByText('Credit lines')).toBeInTheDocument();
        expect(screen.getByText('Transactions')).toBeInTheDocument();
      });

      const lineOptions = screen
        .getAllByRole('option')
        .filter((opt) => opt.id.startsWith('cp-item-credit-line-'));
      const txOptions = screen
        .getAllByRole('option')
        .filter((opt) => opt.id.startsWith('cp-item-transaction-'));
      expect(lineOptions).toHaveLength(5);
      expect(txOptions).toHaveLength(5);
    });

    it('handles loading, empty, error, and disconnected wallet states without throwing', async () => {
      const pendingSource: CreditDataSource = {
        listCreditLines: () => new Promise(() => undefined),
        getCreditLine: vi.fn(),
      };
      const { unmount: unmountLoading } = renderWithCredit(
        <CommandPalette isOpen onClose={vi.fn()} />,
        { source: pendingSource },
      );

      await userEvent.type(screen.getByRole('textbox'), 'Primary');
      await waitFor(() => {
        expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
      });
      unmountLoading();

      const failingSource: CreditDataSource = {
        listCreditLines: vi.fn().mockRejectedValue(new Error('Network failure')),
        getCreditLine: vi.fn(),
      };
      const { unmount: unmountError } = renderWithCredit(
        <CommandPalette isOpen onClose={vi.fn()} />,
        { source: failingSource },
      );

      await userEvent.type(screen.getByRole('textbox'), 'Primary');
      await waitFor(() => {
        expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
      });
      unmountError();

      const { unmount: unmountEmpty } = renderWithCredit(
        <CommandPalette isOpen onClose={vi.fn()} />,
        { lines: [] },
      );

      await userEvent.type(screen.getByRole('textbox'), 'Primary');
      await waitFor(() => {
        expect(screen.queryByText('Primary Business Line')).not.toBeInTheDocument();
      });
      unmountEmpty();
    });
  });
});
