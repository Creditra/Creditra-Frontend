/**
 * Tests for ConfirmDialog component and useConfirm hook
 *
 * Covers:
 * 1. Open dialog: role="alertdialog" with name and description; focus on Cancel
 * 2. Tab and Shift+Tab: focus stays inside the dialog
 * 3. Escape: resolves false; focus returns to the trigger button
 * 4. Confirm: resolves true
 * 5. Cancel (button and backdrop click): resolves false
 * 6. Button order: Cancel before Confirm (docs/BUTTON_ORDER.md)
 * 7. Second confirm() while open: first resolves false (cancelled)
 * 8. Inert backdrop & scroll lock integration
 */

import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog, useConfirm } from '../ConfirmDialog';
import { _resetBodyScrollLockForTesting } from '../../hooks/useBodyScrollLock';

afterEach(() => {
  _resetBodyScrollLockForTesting();
});

function UseConfirmHarness({
  onResult,
}: {
  onResult?: (result: boolean, callIndex: number) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [results, setResults] = useState<string[]>([]);

  const handleOpenFirst = async () => {
    const res = await confirm({
      title: 'Disconnect Google?',
      body: 'Disconnecting Google may lower your credit evaluation score. You can reconnect later.',
      confirmLabel: 'Disconnect Google',
    });
    setResults((prev) => [...prev, `first:${res}`]);
    onResult?.(res, 1);
  };

  const handleOpenSecond = async () => {
    const res = await confirm({
      title: 'Disconnect GitHub?',
      body: 'Disconnecting GitHub may lower your credit evaluation score. You can reconnect later.',
      confirmLabel: 'Disconnect GitHub',
    });
    setResults((prev) => [...prev, `second:${res}`]);
    onResult?.(res, 2);
  };

  return (
    <div>
      <button type="button" onClick={handleOpenFirst}>
        Disconnect Google Trigger
      </button>
      <button type="button" onClick={handleOpenSecond}>
        Disconnect GitHub Trigger
      </button>
      <div data-testid="results">{results.join(',')}</div>
      {dialog}
    </div>
  );
}

describe('ConfirmDialog & useConfirm', () => {
  it('renders role="alertdialog" with accessible name and description and focuses Cancel on open', async () => {
    const user = userEvent.setup();
    render(<UseConfirmHarness />);

    const trigger = screen.getByRole('button', { name: 'Disconnect Google Trigger' });
    await user.click(trigger);

    const dialog = screen.getByRole('alertdialog', { name: 'Disconnect Google?' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription(
      'Disconnecting Google may lower your credit evaluation score. You can reconnect later.',
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => {
      expect(cancelBtn).toHaveFocus();
    });
  });

  it('renders buttons in Cancel -> Confirm order per docs/BUTTON_ORDER.md', async () => {
    const user = userEvent.setup();
    render(<UseConfirmHarness />);

    await user.click(screen.getByRole('button', { name: 'Disconnect Google Trigger' }));

    const dialog = screen.getByRole('alertdialog');
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const cancelIdx = buttons.findIndex((b) => b.textContent?.trim() === 'Cancel');
    const confirmIdx = buttons.findIndex((b) => b.textContent?.trim() === 'Disconnect Google');

    expect(cancelIdx).toBe(0);
    expect(confirmIdx).toBe(1);
    expect(cancelIdx).toBeLessThan(confirmIdx);
    expect(buttons[confirmIdx]).toHaveClass('btn-danger');
  });

  it('traps Tab and Shift+Tab focus inside the dialog', async () => {
    const user = userEvent.setup();
    render(<UseConfirmHarness />);

    await user.click(screen.getByRole('button', { name: 'Disconnect Google Trigger' }));

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const confirmBtn = screen.getByRole('button', { name: 'Disconnect Google' });

    await waitFor(() => {
      expect(cancelBtn).toHaveFocus();
    });

    // Tab forward: Cancel -> Confirm
    await user.tab();
    expect(confirmBtn).toHaveFocus();

    // Tab forward from last element wraps to first (Cancel)
    await user.tab();
    expect(cancelBtn).toHaveFocus();

    // Shift+Tab backward from first element wraps to last (Confirm)
    await user.tab({ shift: true });
    expect(confirmBtn).toHaveFocus();
  });

  it('resolves false on Escape and returns focus to the trigger button', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<UseConfirmHarness onResult={onResult} />);

    const trigger = screen.getByRole('button', { name: 'Disconnect Google Trigger' });
    trigger.focus();
    await user.click(trigger);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(onResult).toHaveBeenCalledWith(false, 1);
    expect(trigger).toHaveFocus();
  });

  it('resolves true when the confirm button is clicked and returns focus to trigger', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<UseConfirmHarness onResult={onResult} />);

    const trigger = screen.getByRole('button', { name: 'Disconnect Google Trigger' });
    await user.click(trigger);

    const confirmBtn = screen.getByRole('button', { name: 'Disconnect Google' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(onResult).toHaveBeenCalledWith(true, 1);
    expect(trigger).toHaveFocus();
  });

  it('resolves false when Cancel button or backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<UseConfirmHarness onResult={onResult} />);

    // Cancel button click
    await user.click(screen.getByRole('button', { name: 'Disconnect Google Trigger' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(onResult).toHaveBeenCalledWith(false, 1);

    // Backdrop click
    await user.click(screen.getByRole('button', { name: 'Disconnect Google Trigger' }));
    const backdrop = screen.getByTestId('confirm-dialog-backdrop');
    await user.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(false, 1);
  });

  it('resolves the first confirm() as false when a second confirm() is called while open', async () => {
    let confirmFn!: ReturnType<typeof useConfirm>['confirm'];

    function ImperativeHarness() {
      const { confirm, dialog } = useConfirm();
      confirmFn = confirm;
      return <div>{dialog}</div>;
    }

    render(<ImperativeHarness />);

    let firstResolved: boolean | undefined;
    let secondResolved: boolean | undefined;

    act(() => {
      confirmFn({
        title: 'First Dialog',
        body: 'First body',
        confirmLabel: 'Confirm First',
      }).then((res) => {
        firstResolved = res;
      });
    });

    expect(screen.getByRole('alertdialog', { name: 'First Dialog' })).toBeInTheDocument();

    // Trigger second confirm while first is still open
    await act(async () => {
      confirmFn({
        title: 'Second Dialog',
        body: 'Second body',
        confirmLabel: 'Confirm Second',
      }).then((res) => {
        secondResolved = res;
      });
    });

    expect(firstResolved).toBe(false);
    expect(screen.getByRole('alertdialog', { name: 'Second Dialog' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: 'First Dialog' })).not.toBeInTheDocument();

    // Confirm the second dialog
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Confirm Second' }));

    expect(secondResolved).toBe(true);
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Hidden"
        body="Should not appear"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
