import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import type { Notification } from '../../types/notification';

function renderWithProvider(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

function renderHarness(harness: React.ReactElement) {
  return renderWithProvider(harness);
}

// Helper to flush React effects
async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

// Check if storage has been rewritten to versioned format
function checkStorageRewrite(key: string, initialValue: string) {
  const value = localStorage.getItem(key);
  if (value === initialValue) {
    throw new Error(`Storage key ${key} still has initial value`);
  }
  try {
    const parsed = JSON.parse(value!);
    if (!parsed.v) throw new Error(`Storage key ${key} not in versioned format`);
  } catch {
    throw new Error(`Storage key ${key} not valid JSON`);
  }
}

describe.sequential('NotificationProvider hydration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const createValidNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'success',
    category: 'transaction',
    title: 'Test notification',
    message: 'This is a test notification',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  });

  it('renders with empty inbox when stored value is "null"', async () => {
    localStorage.setItem('creditra_notifications', 'null');
    localStorage.setItem('creditra_notification_prefs', 'null');

    function Harness() {
      const { notifications, unreadCount } = useNotifications();
      return (
        <div>
          <span data-testid="count">{notifications.length}</span>
          <span data-testid="unread">{unreadCount}</span>
        </div>
      );
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('unread').textContent).toBe('0');

    // Storage should be rewritten to versioned envelope (useLayoutEffect runs synchronously)
    checkStorageRewrite('creditra_notifications', 'null');
    const stored = localStorage.getItem('creditra_notifications');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.v).toBe(1);
    expect(parsed.items).toEqual([]);
  });

  it('renders with empty inbox when stored value is "{}"', async () => {
    localStorage.setItem('creditra_notifications', '{}');

    function Harness() {
      const { notifications } = useNotifications();
      return <span data-testid="count">{notifications.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    checkStorageRewrite('creditra_notifications', '{}');
  });

  it('renders with empty inbox when stored value is "[1, \"x\", {}]"', async () => {
    localStorage.setItem('creditra_notifications', '[1, "x", {}]');

    function Harness() {
      const { notifications } = useNotifications();
      return <span data-testid="count">{notifications.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    checkStorageRewrite('creditra_notifications', '[1, "x", {}]');
  });

  it('keeps 3 valid entries and drops 2 invalid', async () => {
    const valid1 = createValidNotification({ id: '1', title: 'First' });
    const valid2 = createValidNotification({ id: '2', title: 'Second' });
    const valid3 = createValidNotification({ id: '3', title: 'Third' });
    const stored = JSON.stringify([valid1, 123, valid2, 'invalid', {}, valid3]);
    localStorage.setItem('creditra_notifications', stored);

    function Harness() {
      const { notifications } = useNotifications();
      return <span data-testid="count">{notifications.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('3');

    // Storage should be rewritten with only valid entries (useLayoutEffect runs synchronously)
    checkStorageRewrite('creditra_notifications', stored);

    // Storage should be rewritten with only valid entries
    const rewritten = JSON.parse(localStorage.getItem('creditra_notifications')!);
    expect(rewritten.v).toBe(1);
    expect(rewritten.items).toHaveLength(3);
    expect(rewritten.items.map((n: Notification) => n.id)).toEqual(['1', '2', '3']);
  });

  it('caps at 100 entries when 150 valid entries stored', () => {
    const notifications = Array.from({ length: 150 }, (_, i) =>
      createValidNotification({ id: `${i}`, title: `Notification ${i}` })
    );
    localStorage.setItem('creditra_notifications', JSON.stringify(notifications));

    function Harness() {
      const { notifications: notifs } = useNotifications();
      return <span data-testid="count">{notifs.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('100');
  });

  it('deduplicates by id, keeping first occurrence', () => {
    const n1 = createValidNotification({ id: 'dup', title: 'First' });
    const n2 = createValidNotification({ id: 'dup', title: 'Second' });
    const n3 = createValidNotification({ id: 'unique', title: 'Third' });
    localStorage.setItem('creditra_notifications', JSON.stringify([n1, n2, n3]));

    function Harness() {
      const { notifications } = useNotifications();
      return <span data-testid="count">{notifications.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('reads legacy bare array and re-saves as versioned envelope', async () => {
    const notifications = Array.from({ length: 3 }, (_, i) =>
      createValidNotification({ id: `legacy-${i}`, title: `Legacy ${i}` })
    );
    const initialValue = JSON.stringify(notifications);
    localStorage.setItem('creditra_notifications', initialValue);

    function Harness() {
      const { notifications: notifs } = useNotifications();
      return <span data-testid="count">{notifs.length}</span>;
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('3');

    // Should be re-saved as versioned envelope (useLayoutEffect runs synchronously)
    checkStorageRewrite('creditra_notifications', initialValue);

    // Should be re-saved as versioned envelope
    const rewritten = JSON.parse(localStorage.getItem('creditra_notifications')!);
    expect(rewritten.v).toBe(1);
    expect(rewritten.items).toHaveLength(3);
  });

  it('preferences: uses default for string "false", drops bogus key', () => {
    localStorage.setItem(
      'creditra_notification_prefs',
      JSON.stringify({ transaction: 'false', bogus: true })
    );

    function Harness() {
      const { preferences } = useNotifications();
      return (
        <div>
          <span data-testid="transaction">{String(preferences.transaction)}</span>
          <span data-testid="bogus">{String((preferences as Record<string, unknown>).bogus)}</span>
        </div>
      );
    }

    renderHarness(<Harness />);
    // String "false" is not boolean, so default (true) is used
    expect(screen.getByTestId('transaction').textContent).toBe('true');
    // Bogus key should not be present
    expect(screen.getByTestId('bogus').textContent).toBe('undefined');
  });

  it('does not throw when setItem throws QuotaExceededError', () => {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    try {
      function Harness() {
        const { addToast } = useNotifications();
        return (
          <button
            data-testid="add"
            onClick={() => addToast({ type: 'success', category: 'transaction', title: 'T', message: 'M', saveToHistory: true })}
          >
            Add
          </button>
        );
      }

      renderHarness(<Harness />);

      // Should not throw
      act(() => {
        screen.getByTestId('add').click();
      });
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });

  it('fuzz: provider never throws for hostile inbox values', () => {
    const hostileInboxValues = [
      'null',
      '{}',
      '[1, "x", {}]',
      '[]',
      '["not an object"]',
      JSON.stringify({ v: 1, items: 'not array' }),
      JSON.stringify({ v: 2, items: [] }),
      JSON.stringify({ items: [] }),
      JSON.stringify([{ id: '1', type: 'success', category: 'transaction', title: 't', message: 'm', timestamp: 'invalid', read: false }]),
      JSON.stringify([{ id: '1', type: 'success', category: 'transaction', title: 't', message: 'm', timestamp: new Date().toISOString(), read: 'false' }]),
    ];

    for (const raw of hostileInboxValues) {
      localStorage.clear();
      localStorage.setItem('creditra_notifications', raw);

      function Harness() {
        const { notifications } = useNotifications();
        return <span data-testid="count">{notifications.length}</span>;
      }

      expect(() => {
        renderHarness(<Harness />);
      }).not.toThrow();
    }
  });

  it('fuzz: provider never throws for hostile preferences values', () => {
    const hostilePrefsValues = [
      'null',
      '{}',
      '[]',
      '123',
      '"string"',
      'true',
      'false',
      JSON.stringify({ transaction: 'false', bogus: true }),
      JSON.stringify({ transaction: 0, credit_line: 'true' }),
      JSON.stringify({ unknown: 'value' }),
    ];

    for (const raw of hostilePrefsValues) {
      localStorage.clear();
      localStorage.setItem('creditra_notification_prefs', raw);

      function Harness() {
        const { preferences } = useNotifications();
        return <span data-testid="transaction">{String(preferences.transaction)}</span>;
      }

      expect(() => {
        renderHarness(<Harness />);
      }).not.toThrow();
    }
  });

  it('valid existing data survives upgrade unchanged', async () => {
    const notifications = Array.from({ length: 5 }, (_, i) =>
      createValidNotification({ id: `valid-${i}`, title: `Valid ${i}` })
    );
    const initialInbox = JSON.stringify(notifications);
    localStorage.setItem('creditra_notifications', initialInbox);
    localStorage.setItem(
      'creditra_notification_prefs',
      JSON.stringify({ transaction: false, credit_line: true })
    );

    function Harness() {
      const { notifications: notifs, preferences } = useNotifications();
      return (
        <div>
          <span data-testid="count">{notifs.length}</span>
          <span data-testid="trans">{String(preferences.transaction)}</span>
          <span data-testid="credit">{String(preferences.credit_line)}</span>
        </div>
      );
    }

    renderHarness(<Harness />);
    expect(screen.getByTestId('count').textContent).toBe('5');
    expect(screen.getByTestId('trans').textContent).toBe('false');
    expect(screen.getByTestId('credit').textContent).toBe('true');

    // Storage should be rewritten as versioned envelope but with same data (useLayoutEffect runs synchronously)
    checkStorageRewrite('creditra_notifications', initialInbox);

    // Storage should be rewritten as versioned envelope but with same data
    const rewrittenInbox = JSON.parse(localStorage.getItem('creditra_notifications')!);
    expect(rewrittenInbox.v).toBe(1);
    expect(rewrittenInbox.items).toHaveLength(5);
    expect(rewrittenInbox.items.map((n: Notification) => n.id)).toEqual(
      notifications.map((n) => n.id)
    );
  });
});