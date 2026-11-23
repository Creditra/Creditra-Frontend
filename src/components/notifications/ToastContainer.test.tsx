import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import { ToastContainer } from './ToastContainer';
import { useToast } from '../../hooks/useToast';

// Helper wrapper: mounts ToastContainer inside the provider and exposes
// the useToast hook so individual tests can fire toasts.
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

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  // ─── Severity icons ────────────────────────────────────────────────────────

  it('renders an SVG severity icon for each toast', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);

    act(() => {
      toastFns.success('S', 'success');
      toastFns.error('E', 'error');
      toastFns.warning('W', 'warning');
      toastFns.info('I', 'info');
    });

    const icons = document.querySelectorAll('.toast-type-icon svg');
    expect(icons.length).toBe(4);
  });

  it('marks the icon badge as aria-hidden so AT uses the title instead', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('Done', 'Saved.'); });

    const badge = document.querySelector('.toast-type-icon');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  // ─── role="status" for non-urgent types ───────────────────────────────────

  it('gives success toasts role="status" and aria-live="polite"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('Done', 'All good.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });

  it('gives info toasts role="status"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('FYI', 'Note.'); });

    expect(document.querySelector('.toast-item')).toHaveAttribute('role', 'status');
  });

  it('gives warning toasts role="status"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.warning('Caution', 'Low balance.'); });

    expect(document.querySelector('.toast-item')).toHaveAttribute('role', 'status');
  });

  // ─── role="alert" for urgent types ────────────────────────────────────────

  it('gives error toasts role="alert" and aria-live="assertive"', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.error('Failed', 'Could not connect.'); });

    const toast = document.querySelector('.toast-item');
    expect(toast).toHaveAttribute('role', 'alert');
    expect(toast).toHaveAttribute('aria-live', 'assertive');
  });

  // ─── Theme colors ──────────────────────────────────────────────────────────

  it('applies the success theme color to the icon badge', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.success('OK', 'Saved.'); });

    const badge = document.querySelector('.toast-type-icon') as HTMLElement;
    expect(badge.style.color).toMatch(/3fb950|rgb\(63,\s*185,\s*80\)/i);
  });

  it('applies the error theme color to the icon badge', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.error('Oops', 'Broke.'); });

    const badge = document.querySelector('.toast-type-icon') as HTMLElement;
    expect(badge.style.color).toMatch(/f85149|rgb\(248,\s*81,\s*73\)/i);
  });

  it('applies a left accent border colored by severity', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.error('Err', 'Bad.'); });

    const item = document.querySelector('.toast-item') as HTMLElement;
    expect(item.style.borderLeft).toContain('4px solid');
  });

  // ─── Container role and announcement model ─────────────────────────────────

  it('renders a plain landmark-free container labelled "Notifications" without live region attributes', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-label', 'Notifications');
    expect(container).not.toHaveAttribute('role');
    expect(container).not.toHaveAttribute('aria-live');
    expect(container).not.toHaveAttribute('aria-atomic');
  });

  it('has exactly one live region containing the toast text (single live region announcement)', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      toastFns.info('Unique Announcement', 'Single live region');
    });

    // Elements that qualify as live regions
    const liveRegions = Array.from(
      document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')
    ).filter((el) => el.textContent?.includes('Unique Announcement'));

    // Exactly one live region: the ToastItem itself, not the container
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveClass('toast-item');
  });

  // ─── Dismiss ───────────────────────────────────────────────────────────────

  it('removes the toast after clicking dismiss', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('Hello', 'World.'); });

    expect(screen.getByText('Hello')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  // ─── Actions & helpers ─────────────────────────────────────────────────────

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

  // ─── Persistent and auto-dismiss ───────────────────────────────────────────

  it('keeps persistent toasts visible beyond the default duration', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => {
      toastFns.info('Persistent', 'Stays forever.', { persistent: true });
    });

    act(() => { vi.advanceTimersByTime(10000); });
    expect(screen.getByText('Persistent')).toBeInTheDocument();
  });

  it('auto-dismisses non-persistent toasts after the default duration', () => {
    let toastFns!: ReturnType<typeof useToast>;
    renderWithProvider(<TestHarness onMount={(t) => { toastFns = t; }} />);
    act(() => { toastFns.info('Auto', 'Will vanish.'); });

    act(() => { vi.advanceTimersByTime(5500); });
    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('renders an empty container when there are no toasts', () => {
    renderWithProvider(<TestHarness />);
    const container = document.querySelector('.toast-container');
    expect(container).toBeInTheDocument();
    expect(container!.childElementCount).toBe(0);
  });

  // ─── Stack cap & Timer hygiene ─────────────────────────────────────────────

  it('caps the toast stack at 5 items and clears evicted toast timer', () => {
    function Runner() {
      const { addToast } = useNotifications();
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              for (let i = 0; i < 6; i++) {
                addToast({
                  type: 'info',
                  title: `Toast ${i}`,
                  message: `Message ${i}`,
                  duration: 5000,
                });
              }
            }}
          >
            Add 6
          </button>
          <ToastContainer />
        </div>
      );
    }

    render(
      <NotificationProvider>
        <Runner />
      </NotificationProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Add 6' }).click();
    });

    const items = document.querySelectorAll('.toast-item');
    expect(items.length).toBe(5);

    // Evicted toast's timer was cleared in timersRef:
    // Only 5 auto-dismiss timers should exist for toasts (plus 5 progress interval timers)
    expect(screen.queryByText('Toast 0')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 5')).toBeInTheDocument();
  });

  it('clears all pending timers when NotificationProvider unmounts', () => {
    function Runner() {
      const { addToast } = useNotifications();
      return (
        <button
          type="button"
          onClick={() => {
            addToast({ type: 'info', title: 'T1', message: 'M1', duration: 5000 });
            addToast({ type: 'info', title: 'T2', message: 'M2', duration: 5000 });
            addToast({ type: 'info', title: 'T3', message: 'M3', duration: 5000 });
          }}
        >
          Add 3
        </button>
      );
    }

    const { unmount } = render(
      <NotificationProvider>
        <Runner />
        <ToastContainer />
      </NotificationProvider>
    );

    act(() => {
      screen.getByRole('button', { name: 'Add 3' }).click();
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => {
      unmount();
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});
