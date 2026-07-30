/**
 * Tests for the centralized accessible ToastContainer (`src/components/ToastContainer.tsx`).
 *
 * Coverage areas:
 * - Renders inside NotificationProvider
 * - Uses role="status" on the outer queue container
 * - aria-live="polite", aria-atomic="true"
 * - Renders individual toast items with correct severity roles
 * - Dismissing a toast removes it from the DOM
 * - Stack is capped at 5 items
 * - Works with useToast helpers (success, error, warning, info)
 * - Edge cases: empty queue, persistent toasts, action buttons
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationProvider } from '../context/NotificationContext';
import { ToastContainer } from './ToastContainer';
import { useToast } from '../hooks/useToast';

// ── Test harness ──────────────────────────────────────────────────────────────

function TestHarness({
  onMount,
}: {
  onMount?: (toast: ReturnType<typeof useToast>) => void;
}) {
  const toast = useToast();
  if (onMount) onMount(toast);
  return <ToastContainer />;
}

function renderWithProvider(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ToastContainer (centralized queue)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); });

  // ─── Container ARIA ─────────────────────────────────────────────────────────

  it('has role="status" on the outer queue container', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('role', 'status');
  });

  it('has aria-live="polite" on the outer container', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-atomic="true" on the outer container', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('aria-atomic', 'true');
  });

  it('has aria-label="Notifications" on the outer container', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toHaveAttribute('aria-label', 'Notifications');
  });

  // ─── Renders toasts ─────────────────────────────────────────────────────────

  it('renders a toast when useToast().success is called', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => { toastFns.success('Saved', 'Your changes are saved.'); });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Your changes are saved.')).toBeInTheDocument();
  });

  it('renders a toast when useToast().error is called', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => { toastFns.error('Failed', 'Could not connect.'); });

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders all four severity types', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      toastFns.success('S', 'success msg');
      toastFns.error('E', 'error msg');
      toastFns.warning('W', 'warning msg');
      toastFns.info('I', 'info msg');
    });

    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('I')).toBeInTheDocument();
  });

  // ─── Individual toast roles (re-exported from notifications/ToastContainer) ─

  it('gives success toasts role="status" and aria-live="polite"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('Done', 'All good.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('gives error toasts role="alert" and aria-live="assertive"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.error('Failed', 'Broke.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  // ─── Dismiss ────────────────────────────────────────────────────────────────

  it('removes the toast after clicking the dismiss button', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('Dismiss me', 'Click ×.'); });

    expect(screen.getByText('Dismiss me')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });

  // ─── Stack cap ──────────────────────────────────────────────────────────────

  it('caps the toast stack at 5 items', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      for (let i = 0; i < 7; i++) {
        toastFns.info(`Toast ${i}`, 'msg');
      }
    });

    const items = document.querySelectorAll('.toast-item');
    expect(items.length).toBeLessThanOrEqual(5);
  });

  // ─── Action buttons ─────────────────────────────────────────────────────────

  it('renders an action button when an action is provided', () => {
    const onAction = vi.fn();
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      toastFns.info('With action', 'Click below.', {
        action: { label: 'View details', onClick: onAction },
      });
    });

    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
  });

  it('fires the action callback when the action button is clicked', () => {
    const onAction = vi.fn();
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      toastFns.info('Action test', 'Perform action.', {
        action: { label: 'Do it', onClick: onAction },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /do it/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  // ─── Persistent toasts ─────────────────────────────────────────────────────

  it('keeps persistent toasts visible beyond the default duration', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      toastFns.info('Persistent', 'Stays forever.', { persistent: true });
    });

    act(() => { vi.advanceTimersByTime(10000); });

    expect(screen.getByText('Persistent')).toBeInTheDocument();
  });

  // ─── Auto-dismiss after duration ────────────────────────────────────────────

  it('auto-dismisses non-persistent toasts after the default duration', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('Auto', 'Will vanish.'); });

    act(() => { vi.advanceTimersByTime(5500); });
    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  // ─── Empty state ───────────────────────────────────────────────────────────

  it('renders an empty container when there are no toasts', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
    expect(container!.childElementCount).toBe(0);
  });

  // ─── Icon accessibility ─────────────────────────────────────────────────────

  it('marks the icon badge as aria-hidden', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('Icon test', 'Check icon.'); });

    const badge = document.querySelector('.toast-type-icon');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });
});
