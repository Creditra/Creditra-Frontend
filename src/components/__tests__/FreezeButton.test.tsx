import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FreezeButton } from '../FreezeButton';

describe('FreezeButton', () => {
  const defaultProps = {
    lineId: 'CL-001',
    lineName: 'Test Credit Line',
    onFreeze: vi.fn(),
    onUnfreeze: vi.fn(),
  };

  describe('freeze mode (frozen=false)', () => {
    it('renders a Freeze button', () => {
      render(<FreezeButton {...defaultProps} frozen={false} />);
      expect(
        screen.getByRole('button', { name: /freeze test credit line/i }),
      ).toBeInTheDocument();
    });

    it('shows the Snowflake icon on the trigger button', () => {
      render(<FreezeButton {...defaultProps} frozen={false} />);
      const btn = screen.getByRole('button', { name: /freeze test credit line/i });
      expect(btn.querySelector('.freeze-btn__icon')).toBeInTheDocument();
    });

    it('shows freeze confirmation dialog on click', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);
      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));

      expect(
        screen.getByRole('dialog', { name: /confirm freeze for test credit line/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/freeze test credit line\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/draws will be blocked/i),
      ).toBeInTheDocument();
    });

    it('shows Cancel and Freeze buttons in confirmation', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);
      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));

      expect(
        screen.getByRole('button', { name: /cancel freeze/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /confirm freeze/i }),
      ).toBeInTheDocument();
    });

    it('calls onFreeze with lineId when confirmed', async () => {
      const user = userEvent.setup();
      const onFreeze = vi.fn();
      render(<FreezeButton {...defaultProps} frozen={false} onFreeze={onFreeze} />);

      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /confirm freeze/i }));

      expect(onFreeze).toHaveBeenCalledOnce();
      expect(onFreeze).toHaveBeenCalledWith('CL-001');
    });

    it('does not call onFreeze when cancelled', async () => {
      const user = userEvent.setup();
      const onFreeze = vi.fn();
      render(<FreezeButton {...defaultProps} frozen={false} onFreeze={onFreeze} />);

      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /cancel freeze/i }));

      expect(onFreeze).not.toHaveBeenCalled();
    });

    it('hides confirmation when cancelled and shows trigger button again', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);

      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /cancel freeze/i }));

      expect(
        screen.getByRole('button', { name: /freeze test credit line/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });

    it('closes confirmation on Escape key', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);

      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));
      const dialog = screen.getByRole('dialog', { name: /confirm freeze for test credit line/i });
      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      expect(dialog).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /freeze test credit line/i }),
      ).toBeInTheDocument();
    });

    it('hides confirmation dialog after confirming freeze', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);

      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /confirm freeze/i }));

      expect(
        screen.queryByRole('dialog'),
      ).not.toBeInTheDocument();
    });
  });

  describe('unfreeze mode (frozen=true)', () => {
    it('renders an Unfreeze button', () => {
      render(<FreezeButton {...defaultProps} frozen={true} />);
      expect(
        screen.getByRole('button', { name: /unfreeze test credit line/i }),
      ).toBeInTheDocument();
    });

    it('shows unfreeze confirmation dialog on click', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={true} />);
      await user.click(screen.getByRole('button', { name: /unfreeze test credit line/i }));

      expect(
        screen.getByRole('dialog', { name: /confirm unfreeze for test credit line/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/unfreeze test credit line\?/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/this credit line will be reactivated/i),
      ).toBeInTheDocument();
    });

    it('calls onUnfreeze with lineId when confirmed', async () => {
      const user = userEvent.setup();
      const onUnfreeze = vi.fn();
      render(<FreezeButton {...defaultProps} frozen={true} onUnfreeze={onUnfreeze} />);

      await user.click(screen.getByRole('button', { name: /unfreeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /confirm unfreeze/i }));

      expect(onUnfreeze).toHaveBeenCalledOnce();
      expect(onUnfreeze).toHaveBeenCalledWith('CL-001');
    });

    it('does not call onUnfreeze when cancelled', async () => {
      const user = userEvent.setup();
      const onUnfreeze = vi.fn();
      render(<FreezeButton {...defaultProps} frozen={true} onUnfreeze={onUnfreeze} />);

      await user.click(screen.getByRole('button', { name: /unfreeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /cancel unfreeze/i }));

      expect(onUnfreeze).not.toHaveBeenCalled();
    });

    it('returns to trigger button after cancelling unfreeze', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={true} />);

      await user.click(screen.getByRole('button', { name: /unfreeze test credit line/i }));
      await user.click(screen.getByRole('button', { name: /cancel unfreeze/i }));

      expect(
        screen.getByRole('button', { name: /unfreeze test credit line/i }),
      ).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('trigger button has aria-haspopup="dialog"', () => {
      render(<FreezeButton {...defaultProps} frozen={false} />);
      expect(
        screen.getByRole('button', { name: /freeze test credit line/i }),
      ).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('confirmation dialog has accessible label', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);
      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute(
        'aria-label',
        'Confirm freeze for Test Credit Line',
      );
    });

    it('cancel button has accessible label in freeze mode', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={false} />);
      await user.click(screen.getByRole('button', { name: /freeze test credit line/i }));

      expect(
        screen.getByRole('button', { name: /cancel freeze/i }),
      ).toBeInTheDocument();
    });

    it('confirm button has accessible label in unfreeze mode', async () => {
      const user = userEvent.setup();
      render(<FreezeButton {...defaultProps} frozen={true} />);
      await user.click(screen.getByRole('button', { name: /unfreeze test credit line/i }));

      expect(
        screen.getByRole('button', { name: /confirm unfreeze/i }),
      ).toBeInTheDocument();
    });
  });

  describe('offline state', () => {
    beforeEach(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: true,
      });
    });

    it('disables Freeze button with accessible reason when offline and re-enables when back online', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: false,
      });

      render(<FreezeButton {...defaultProps} frozen={false} />);

      const btn = screen.getByRole('button', { name: /freeze test credit line/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-disabled', 'true');
      expect(btn).toHaveAccessibleDescription("You're offline — reconnect to freeze");

      act(() => {
        Object.defineProperty(window.navigator, 'onLine', {
          configurable: true,
          value: true,
        });
        window.dispatchEvent(new Event('online'));
      });

      expect(btn).toBeEnabled();
    });

    it('shows unfreeze offline reason when frozen=true and offline', () => {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        value: false,
      });

      render(<FreezeButton {...defaultProps} frozen={true} />);

      const btn = screen.getByRole('button', { name: /unfreeze test credit line/i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAccessibleDescription("You're offline — reconnect to unfreeze");
    });
  });
});
