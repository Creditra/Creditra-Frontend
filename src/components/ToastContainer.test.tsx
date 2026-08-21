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
 * - Works with useToast helpers (success, error, warning, info, danger)
 * - Edge cases: empty queue, persistent toasts, action buttons
 * - Muted category suppression
 * - Programmatic dismiss by id
 * - FIFO ordering (newest-first: most-recent toast appears first in the DOM)
 * - warning gets role=status (polite)
 * - danger gets role=alert (assertive)
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationProvider } from '../context/NotificationContext';
import { ToastContainer } from './ToastContainer';
import { useToast } from '../hooks/useToast';
import { useNotifications } from '../context/NotificationContext';

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
  beforeEach(() => {
    vi.useFakeTimers();
    // Prevent localStorage written by one test leaking into the next.
    // NotificationContext reads preferences from localStorage on mount,
    // so stale prefs (e.g. { system: false }) would mute subsequent tests.
    localStorage.clear();
  });
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

  it('renders all five severity types including danger', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      toastFns.success('S', 'success msg');
      toastFns.error('E', 'error msg');
      toastFns.warning('W', 'warning msg');
      toastFns.info('I', 'info msg');
      toastFns.danger('D', 'danger msg');
    });

    // Five types were added but stack cap is 5, so all should appear
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getByText('I')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  // ─── Individual toast roles ──────────────────────────────────────────────────

  it('gives success toasts role="status" and aria-live="polite"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('Done', 'All good.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('gives warning toasts role="status" (polite — not an interruption)', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.warning('Low balance', 'Approaching limit.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('gives info toasts role="status"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('FYI', 'Just so you know.'); });

    expect(document.querySelector('.toast-item')).toHaveAttribute('role', 'status');
  });

  it('gives error toasts role="alert" and aria-live="assertive"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.error('Failed', 'Broke.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  it('gives danger toasts role="alert" and aria-live="assertive"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.danger('Access denied', 'Session expired.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  // ─── danger() helper ────────────────────────────────────────────────────────

  it('useToast().danger() renders a toast with the danger severity CSS class', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.danger('Security alert', 'Something went wrong.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveClass('toast-item--danger');
  });

  it('useToast().danger() returns a non-empty id string', () => {
    let id = '';
    function IdCapture() {
      const toast = useToast();
      act(() => { id = toast.danger('Danger', 'msg'); });
      return <ToastContainer />;
    }
    render(<NotificationProvider><IdCapture /></NotificationProvider>);
    expect(id).toBeTruthy();
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

  // ─── Programmatic dismiss by id ──────────────────────────────────────────────

  it('toast.dismiss(id) removes the specific toast from the DOM', () => {
    let toastFns!: ReturnType<typeof useToast>;
    let capturedId = '';
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      capturedId = toastFns.info('Programmatic', 'Will be dismissed by id.');
    });

    expect(screen.getByText('Programmatic')).toBeInTheDocument();

    act(() => { toastFns.dismiss(capturedId); });

    expect(screen.queryByText('Programmatic')).not.toBeInTheDocument();
  });

  it('toast.dismiss(id) leaves other toasts untouched', () => {
    let toastFns!: ReturnType<typeof useToast>;
    let firstId = '';
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      firstId = toastFns.info('First', 'Will be dismissed.');
      toastFns.info('Second', 'Should remain.');
    });

    act(() => { toastFns.dismiss(firstId); });

    expect(screen.queryByText('First')).not.toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
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

  // ─── FIFO / newest-first ordering ───────────────────────────────────────────

  it('displays the most recently added toast first (newest-first FIFO)', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      toastFns.info('First toast', 'Oldest');
      toastFns.info('Second toast', 'Middle');
      toastFns.info('Third toast', 'Newest');
    });

    const items = document.querySelectorAll('.toast-item .toast-title');
    // NotificationContext prepends with [toast, ...prev], so newest is index 0
    expect(items[0].textContent).toBe('Third toast');
    expect(items[1].textContent).toBe('Second toast');
    expect(items[2].textContent).toBe('First toast');
  });

  // ─── Muted category suppression ──────────────────────────────────────────────

  it('suppresses a toast when its category is muted in preferences', () => {
    /**
     * Pattern: expose imperative handles via captured refs so the test body
     * can sequence a preference update (act #1) then fire the toast (act #2).
     * Both must be separate act() calls: updatePreferences triggers a
     * re-render which rebinds the addToast closure; the second act() then
     * calls addToast with the newly-captured preferences value.
     */
    let notif!: ReturnType<typeof useNotifications>;
    let toastFns!: ReturnType<typeof useToast>;

    function MuteTestHarness() {
      notif = useNotifications();
      toastFns = useToast();
      return <ToastContainer />;
    }

    render(<NotificationProvider><MuteTestHarness /></NotificationProvider>);

    act(() => { notif.updatePreferences({ transaction: false }); });
    act(() => { toastFns.info('Muted toast', 'Should not appear.', { category: 'transaction' }); });

    expect(screen.queryByText('Muted toast')).not.toBeInTheDocument();
  });

  it('does not suppress a toast when its category is enabled in preferences', () => {
    let notif!: ReturnType<typeof useNotifications>;
    let toastFns!: ReturnType<typeof useToast>;

    function EnabledTestHarness() {
      notif = useNotifications();
      toastFns = useToast();
      return <ToastContainer />;
    }

    render(<NotificationProvider><EnabledTestHarness /></NotificationProvider>);

    // transaction is enabled by default, but ensure it explicitly
    act(() => { notif.updatePreferences({ transaction: true }); });
    act(() => { toastFns.info('Visible toast', 'Should appear.', { category: 'transaction' }); });

    expect(screen.getByText('Visible toast')).toBeInTheDocument();
  });

  it('toast.danger() returns empty string when its category is muted', () => {
    let returnedId = 'non-empty';
    let notif!: ReturnType<typeof useNotifications>;
    let toastFns!: ReturnType<typeof useToast>;

    function MuteHarness() {
      notif = useNotifications();
      toastFns = useToast();
      return <ToastContainer />;
    }

    render(<NotificationProvider><MuteHarness /></NotificationProvider>);

    // Mute 'system', then fire — separate acts so addToast sees updated prefs
    act(() => { notif.updatePreferences({ system: false }); });
    act(() => {
      returnedId = toastFns.danger('Muted danger', 'Suppressed.', { category: 'system' });
    });

    expect(returnedId).toBe('');
    expect(screen.queryByText('Muted danger')).not.toBeInTheDocument();
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
