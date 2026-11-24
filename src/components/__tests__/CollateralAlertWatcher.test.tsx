import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CollateralAlertWatcher } from '../CollateralAlertWatcher';
import { NotificationProvider, useNotifications } from '../../context/NotificationContext';
import {
  setLastNotifiedLevel,
  getLastNotifiedLevel,
  COLLATERAL_ALERTS_STORAGE_KEY,
} from '../../state/collateralAlerts';
import type { CreditLine } from '../../types/creditLine';

function ToastInspector() {
  const { toasts } = useNotifications();
  return (
    <div>
      <output data-testid="toast-count">{toasts.length}</output>
      <output data-testid="toast-titles">{toasts.map((t) => t.title).join('|')}</output>
      <output data-testid="toast-types">{toasts.map((t) => t.type).join('|')}</output>
      <output data-testid="toast-actions">
        {toasts.map((t) => t.action?.label).join('|')}
      </output>
    </div>
  );
}

const mockLine = (overrides: Partial<CreditLine> = {}): CreditLine => ({
  id: 'CL-TEST-1',
  name: 'Test Business Line',
  status: 'Active',
  limit: 500_000,
  utilized: 200_000,
  apr: 8.5,
  riskScore: 750,
  collateral: 'USDC Treasury', // AVAILABLE_COLLATERAL_ASSETS has USDC Treasury: value = 500,000
  openedAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  transactions: [],
  statusHistory: [],
  ...overrides,
});

function renderWatcher(lines?: CreditLine[]) {
  return render(
    <BrowserRouter>
      <NotificationProvider>
        <CollateralAlertWatcher lines={lines} intervalMs={1000} />
        <ToastInspector />
      </NotificationProvider>
    </BrowserRouter>
  );
}

describe('CollateralAlertWatcher', () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('ignores lines without collateral', () => {
    vi.useFakeTimers();
    const unsecuredLine = mockLine({ collateral: undefined, utilized: 480_000 });
    const emptyCollateralLine = mockLine({ collateral: '', utilized: 480_000 });

    renderWatcher([unsecuredLine, emptyCollateralLine]);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('notifies once when warning threshold is crossed', () => {
    vi.useFakeTimers();
    // USDC Treasury value is 500,000. 410,000 utilized = 82% LTV (>= 80% warning)
    const line = mockLine({ utilized: 410_000 });

    const view = renderWatcher([line]);

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(screen.getByTestId('toast-titles').textContent).toContain('Collateral warning');
    expect(screen.getByTestId('toast-types').textContent).toBe('warning');
    expect(screen.getByTestId('toast-actions').textContent).toBe('Add collateral / repay');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');

    // Subsequent re-evaluations do not re-emit
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');

    view.unmount();
  });

  it('handles jump straight to liquidation', () => {
    vi.useFakeTimers();
    // 460,000 utilized = 92% LTV (>= 90% liquidation threshold)
    const line = mockLine({ utilized: 460_000 });

    renderWatcher([line]);

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(screen.getByTestId('toast-titles').textContent).toContain('Liquidation risk alert');
    expect(screen.getByTestId('toast-types').textContent).toBe('danger');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('liquidation');
  });

  it('transitions from warning to liquidation with a new notification', () => {
    vi.useFakeTimers();
    // Start at 82% LTV
    const warningLine = mockLine({ utilized: 410_000 });
    const { rerender } = renderWatcher([warningLine]);

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');

    // Jump to 92% LTV
    const liquidationLine = mockLine({ utilized: 460_000 });
    rerender(
      <BrowserRouter>
        <NotificationProvider>
          <CollateralAlertWatcher lines={[liquidationLine]} intervalMs={1000} />
          <ToastInspector />
        </NotificationProvider>
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('toast-count').textContent).toBe('2');
    expect(screen.getByTestId('toast-titles').textContent).toContain('Liquidation risk alert');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('liquidation');
  });

  it('hovers around threshold without repeating notifications', () => {
    vi.useFakeTimers();
    // 410,000 / 500,000 = 82% LTV -> warning
    const line1 = mockLine({ utilized: 410_000 });
    const { rerender } = renderWatcher([line1]);

    expect(screen.getByTestId('toast-count').textContent).toBe('1');

    // Drops slightly to 395,000 = 79% (below 80% threshold, but above 75% hysteresis reset)
    const line2 = mockLine({ utilized: 395_000 });
    rerender(
      <BrowserRouter>
        <NotificationProvider>
          <CollateralAlertWatcher lines={[line2]} intervalMs={1000} />
          <ToastInspector />
        </NotificationProvider>
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');

    // Rises back to 81% (405,000) -> should NOT re-notify because it never recovered
    const line3 = mockLine({ utilized: 405_000 });
    rerender(
      <BrowserRouter>
        <NotificationProvider>
          <CollateralAlertWatcher lines={[line3]} intervalMs={1000} />
          <ToastInspector />
        </NotificationProvider>
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('persists across reload without repeating notifications', () => {
    vi.useFakeTimers();
    // Simulate pre-existing persisted warning alert in localStorage
    setLastNotifiedLevel('CL-TEST-1', 'warning');

    // Mount watcher with line already at warning level (82% LTV)
    const line = mockLine({ utilized: 410_000 });
    renderWatcher([line]);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // No duplicate notification should have been emitted
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');
  });

  it('re-arms when LTV recovers below hysteresis and notifies on next upward crossing', () => {
    vi.useFakeTimers();
    // Start in warning
    const warningLine = mockLine({ utilized: 410_000 });
    const { rerender } = renderWatcher([warningLine]);

    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');

    // Fully recovers: drops to 350,000 = 70% (< 75% reset threshold)
    const recoveredLine = mockLine({ utilized: 350_000 });
    rerender(
      <BrowserRouter>
        <NotificationProvider>
          <CollateralAlertWatcher lines={[recoveredLine]} intervalMs={1000} />
          <ToastInspector />
        </NotificationProvider>
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Stored alert level is cleared (re-armed), no new toast emitted for recovery
    expect(getLastNotifiedLevel('CL-TEST-1')).toBeNull();
    expect(screen.getByTestId('toast-count').textContent).toBe('1');

    // Rises back to warning level (410,000 = 82%)
    rerender(
      <BrowserRouter>
        <NotificationProvider>
          <CollateralAlertWatcher lines={[warningLine]} intervalMs={1000} />
          <ToastInspector />
        </NotificationProvider>
      </BrowserRouter>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should emit a new warning toast
    expect(screen.getByTestId('toast-count').textContent).toBe('2');
    expect(getLastNotifiedLevel('CL-TEST-1')).toBe('warning');
  });
});
