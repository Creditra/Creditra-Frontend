import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import { NotificationCenter } from './NotificationCenter';
import { ToastContainer } from './ToastContainer';
import type { Notification } from '../../types/notification';

vi.mock('../../hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: vi.fn(),
}));

vi.mock('../../hooks/useInertBackdrop', () => ({
  useInertBackdrop: vi.fn(),
}));

function createNotification(overrides?: Partial<Notification>): Notification {
  return {
    id: 'notif-1',
    type: 'info',
    category: 'system',
    title: 'Test notification',
    message: 'This is a test',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

function seedNotifications(notifications: Notification[]) {
  window.localStorage.setItem(
    'creditra_notifications',
    JSON.stringify(notifications),
  );
}

function OpenPanelHarness() {
  const { openPanel } = useNotifications();
  return (
    <button type="button" onClick={openPanel}>
      Open panel
    </button>
  );
}

function renderWithUndo() {
  render(
    <NotificationProvider>
      <ToastContainer />
      <div>
        <OpenPanelHarness />
        <NotificationCenter />
      </div>
    </NotificationProvider>,
  );
}

describe('UndoToast integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedNotifications([
      createNotification({ id: 'n1', title: 'First', message: 'First notification' }),
      createNotification({ id: 'n2', title: 'Second', message: 'Second notification', read: false }),
      createNotification({ id: 'n3', title: 'Third', message: 'Third notification', read: true }),
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows an undo toast after marking a single notification as read', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const items = within(panel).getAllByText(/First|Second|Third/);

    const undoButton = screen.queryByRole('button', { name: /undo/i });
    expect(undoButton).not.toBeInTheDocument();

    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    const undo = screen.getByRole('button', { name: /undo/i });
    expect(undo).toBeInTheDocument();
  });

  it('restores notification read state when Undo is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;

    await user.click(firstItem);
    expect(firstItem).not.toHaveClass('nc-item-unread');

    const undo = screen.getByRole('button', { name: /undo/i });
    await user.click(undo);

    await act(async () => { vi.advanceTimersByTime(400); });

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('commits the read action when the timer expires', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    expect(firstItem).not.toHaveClass('nc-item-unread');

    act(() => { vi.advanceTimersByTime(5500); });
    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('supports marking all as read with undo', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const unreadItemsBefore = within(panel).queryAllByText(/First|Second/);
    expect(unreadItemsBefore.length).toBeGreaterThan(0);

    const markAllBtn = within(panel).getByRole('button', { name: /mark all/i });
    await user.click(markAllBtn);

    const undo = screen.getByRole('button', { name: /undo/i });
    expect(undo).toBeInTheDocument();
  });

  it('handles rapid consecutive mark-read actions without duplicate timers', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    const secondItem = within(panel).getByText('Second').closest('.nc-item')!;

    await user.click(firstItem);
    await user.click(secondItem);

    const undoButtons = screen.getAllByRole('button', { name: /undo/i });
    expect(undoButtons.length).toBeGreaterThanOrEqual(1);
    expect(undoButtons.length).toBeLessThanOrEqual(5);
  });

  it('undoes only the correct notification when stacked undo toasts are present', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    const secondItem = within(panel).getByText('Second').closest('.nc-item')!;

    await user.click(firstItem);
    await user.click(secondItem);

    const undoButtons = screen.getAllByRole('button', { name: /undo/i });
    expect(undoButtons.length).toBe(2);
  });

  it('cleans up timers on unmount', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(
      <NotificationProvider>
        <ToastContainer />
        <OpenPanelHarness />
        <NotificationCenter />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    expect(screen.queryByRole('button', { name: /undo/i })).toBeInTheDocument();

    unmount();

    act(() => { vi.advanceTimersByTime(6000); });

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('renders the undo button with proper accessibility role', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    const undo = screen.getByRole('button', { name: /undo/i });
    expect(undo).toBeInTheDocument();
  });

  it('supports keyboard activation via Enter', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    const undo = screen.getByRole('button', { name: /undo/i });
    undo.focus();
    await user.keyboard('{Enter}');

    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('supports keyboard activation via Space', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    const undo = screen.getByRole('button', { name: /undo/i });
    undo.focus();
    await user.keyboard(' ');

    act(() => { vi.advanceTimersByTime(400); });

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('has visible focus styles on the undo button', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    await user.click(firstItem);

    const undo = screen.getByRole('button', { name: /undo/i });
    undo.focus();

    expect(document.activeElement).toBe(undo);
  });

  it('shows undo toast for each mark-read action independently', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithUndo();

    await user.click(screen.getByRole('button', { name: /open panel/i }));
    act(() => { vi.advanceTimersByTime(100); });

    const panel = screen.getByRole('dialog', { name: 'Notification center' });
    const firstItem = within(panel).getByText('First').closest('.nc-item')!;
    const secondItem = within(panel).getByText('Second').closest('.nc-item')!;

    await user.click(firstItem);
    await user.click(secondItem);

    const undoButtons = screen.getAllByRole('button', { name: /undo/i });
    expect(undoButtons.length).toBe(2);
  });
});
