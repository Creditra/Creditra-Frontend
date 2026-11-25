import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OfflineQueuePanel,
  closeOfflineQueuePanel,
  formatQueuedActionAge,
  openOfflineQueuePanel,
  resetOfflineQueuePanelForTests,
} from '../OfflineQueuePanel';
import {
  listQueuedActions,
  queueOfflineAction,
  resetOfflineQueueForTests,
} from '../../utils/offline';

function openPanel() {
  const view = render(<OfflineQueuePanel />);
  act(() => openOfflineQueuePanel());
  return view;
}

describe('OfflineQueuePanel', () => {
  beforeEach(() => {
    resetOfflineQueueForTests();
    resetOfflineQueuePanelForTests();
  });

  afterEach(() => {
    act(() => closeOfflineQueuePanel());
    resetOfflineQueueForTests();
    resetOfflineQueuePanelForTests();
  });

  it('renders an accessible dialog only when opened', () => {
    render(<OfflineQueuePanel />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => openOfflineQueuePanel());

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Queued actions');
    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
  });

  it('lists queued actions with type, status and age', () => {
    queueOfflineAction({
      type: 'draw',
      label: 'Draw $500.00',
      description: 'Prime Working Capital',
      run: () => {},
    });

    openPanel();

    expect(screen.getByText('draw')).toBeInTheDocument();
    expect(screen.getByText('Draw $500.00')).toBeInTheDocument();
    expect(screen.getByText('Prime Working Capital')).toBeInTheDocument();
    expect(screen.getByText('Waiting for connection')).toBeInTheDocument();
    expect(screen.getByText(/Queued just now/)).toBeInTheDocument();
  });

  it('cancels an action permanently', () => {
    queueOfflineAction({ type: 'upload', label: 'Upload invoice.pdf', run: () => {} });

    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Upload invoice.pdf' }));

    expect(screen.queryByText('Upload invoice.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('cancelled');
    expect(listQueuedActions()).toHaveLength(0);
  });

  it('removes an action after a successful retry', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    queueOfflineAction({ type: 'draw', label: 'Draw $250.00', run });

    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Draw $250.00' }));

    await waitFor(() => {
      expect(screen.queryByText('Draw $250.00')).not.toBeInTheDocument();
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('completed');
    expect(listQueuedActions()).toHaveLength(0);
  });

  it('keeps a failed action queued with its error and increments attempts', async () => {
    queueOfflineAction({
      type: 'draw',
      label: 'Draw $250.00',
      run: () => Promise.reject(new Error('Ledger unavailable')),
    });

    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Draw $250.00' }));

    await waitFor(() => {
      expect(screen.getByText('Ledger unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/1 attempt/)).toBeInTheDocument();

    const [queued] = listQueuedActions();
    expect(queued.status).toBe('failed');
    expect(queued.attempts).toBe(1);
  });

  it('closes on Escape and restores focus', () => {
    openPanel();
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('formats relative ages compactly', () => {
    const now = Date.parse('2026-11-24T12:00:00Z');

    expect(formatQueuedActionAge(now - 10_000, now)).toBe('just now');
    expect(formatQueuedActionAge(now - 4 * 60_000, now)).toBe('4m ago');
    expect(formatQueuedActionAge(now - 3 * 60 * 60_000, now)).toBe('3h ago');
    expect(formatQueuedActionAge(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
  });
});
