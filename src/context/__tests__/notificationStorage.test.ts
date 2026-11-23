import { describe, it, expect, vi } from 'vitest';
import {
  parseInbox,
  parsePreferences,
  serializeInbox,
  serializePreferences,
} from '../notificationStorage';
import type { Notification, NotificationPreferences } from '../../types/notification';

function createValidNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'success',
    category: 'transaction',
    title: 'Test notification',
    message: 'This is a test notification',
    timestamp: new Date().toISOString(),
    read: false,
    ...overrides,
  };
}

describe('parseInbox', () => {
  it('returns empty array for null', () => {
    expect(parseInbox(null)).toEqual([]);
  });

  it('returns empty array for plain object', () => {
    expect(parseInbox({})).toEqual([]);
  });

  it('returns empty array for array with invalid entries', () => {
    expect(parseInbox([1, 'x', {}])).toEqual([]);
  });

  it('keeps valid entries and drops invalid ones', () => {
    const valid1 = createValidNotification({ id: '1', title: 'First' });
    const valid2 = createValidNotification({ id: '2', title: 'Second' });
    const valid3 = createValidNotification({ id: '3', title: 'Third' });
    const input = [valid1, 123, valid2, 'invalid', {}, valid3];
    const result = parseInbox(input);
    expect(result).toHaveLength(3);
    expect(result.map((n) => n.id)).toEqual(['1', '2', '3']);
  });

  it('caps at 100 entries', () => {
    const notifications = Array.from({ length: 150 }, (_, i) =>
      createValidNotification({ id: `${i}`, title: `Notification ${i}` })
    );
    const result = parseInbox(notifications);
    expect(result).toHaveLength(100);
  });

  it('deduplicates by id, keeping first occurrence', () => {
    const n1 = createValidNotification({ id: 'dup', title: 'First' });
    const n2 = createValidNotification({ id: 'dup', title: 'Second' });
    const n3 = createValidNotification({ id: 'unique', title: 'Third' });
    const result = parseInbox([n1, n2, n3]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('First');
  });

  it('reads legacy bare array format', () => {
    const notifications = Array.from({ length: 3 }, (_, i) =>
      createValidNotification({ id: `legacy-${i}`, title: `Legacy ${i}` })
    );
    const result = parseInbox(notifications);
    expect(result).toHaveLength(3);
  });

  it('reads versioned envelope format', () => {
    const notifications = Array.from({ length: 3 }, (_, i) =>
      createValidNotification({ id: `envelope-${i}`, title: `Envelope ${i}` })
    );
    const envelope = { v: 1, items: notifications };
    const result = parseInbox(envelope);
    expect(result).toHaveLength(3);
  });

  it('rejects envelope with wrong version', () => {
    const notifications = [createValidNotification({ id: '1' })];
    const envelope = { v: 2, items: notifications };
    expect(parseInbox(envelope)).toEqual([]);
  });

  it('rejects envelope with non-array items', () => {
    const envelope = { v: 1, items: 'not an array' };
    expect(parseInbox(envelope)).toEqual([]);
  });

  it('validates required fields: id', () => {
    const n = createValidNotification({ id: '' });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: type', () => {
    const n = createValidNotification({ type: 'invalid' as never });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: category', () => {
    const n = createValidNotification({ category: 'invalid' as never });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: title', () => {
    const n = createValidNotification({ title: '' });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: timestamp (invalid ISO)', () => {
    const n = createValidNotification({ timestamp: 'not-a-date' });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: timestamp (parseable but not ISO)', () => {
    // Date that parses but doesn't match ISO format exactly
    const n = createValidNotification({ timestamp: '2024-01-01' });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('validates required fields: read (boolean)', () => {
    const n = createValidNotification({ read: 'false' as never });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('accepts valid action object', () => {
    const n = createValidNotification({
      action: { label: 'View', onClick: vi.fn() },
    });
    expect(parseInbox([n])).toHaveLength(1);
  });

  it('rejects invalid action object', () => {
    const n = createValidNotification({
      action: { label: 'View' } as never, // missing onClick
    });
    expect(parseInbox([n])).toHaveLength(0);
  });

  it('handles string input gracefully', () => {
    expect(parseInbox('not an array')).toEqual([]);
  });

  it('handles number input gracefully', () => {
    expect(parseInbox(123)).toEqual([]);
  });
});

describe('parsePreferences', () => {
  it('returns defaults for null', () => {
    expect(parsePreferences(null)).toEqual({
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      system: true,
    });
  });

  it('returns defaults for plain object with no valid keys', () => {
    expect(parsePreferences({})).toEqual({
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      system: true,
    });
  });

  it('accepts valid boolean preferences', () => {
    const input = { transaction: false, credit_line: true };
    const result = parsePreferences(input);
    expect(result.transaction).toBe(false);
    expect(result.credit_line).toBe(true);
    expect(result.risk_score).toBe(true); // default
  });

  it('drops unknown categories', () => {
    const input = { bogus: true, transaction: false };
    const result = parsePreferences(input);
    expect(result.bogus).toBeUndefined();
    expect(result.transaction).toBe(false);
  });

  it('drops non-boolean values', () => {
    const input = { transaction: 'false', credit_line: 0, risk_score: 'true' };
    const result = parsePreferences(input);
    expect(result.transaction).toBe(true); // default, string "false" is not boolean
    expect(result.credit_line).toBe(true); // default, number 0 is not boolean
    expect(result.risk_score).toBe(true); // default, string "true" is not boolean
  });

  it('handles string input gracefully', () => {
    expect(parsePreferences('not an object')).toEqual({
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      system: true,
    });
  });

  it('handles number input gracefully', () => {
    expect(parsePreferences(123)).toEqual({
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      system: true,
    });
  });

  it('handles array input gracefully', () => {
    expect(parsePreferences([true, false])).toEqual({
      transaction: true,
      credit_line: true,
      risk_score: true,
      rate_change: true,
      system: true,
    });
  });
});

describe('serializeInbox', () => {
  it('produces versioned envelope', () => {
    const notifications = [createValidNotification({ id: '1' })];
    const serialized = serializeInbox(notifications);
    expect(serialized.v).toBe(1);
    expect(serialized.items).toHaveLength(1);
    expect(serialized.items[0].id).toBe('1');
  });

  it('caps at 100 entries', () => {
    const notifications = Array.from({ length: 150 }, (_, i) =>
      createValidNotification({ id: `${i}` })
    );
    const serialized = serializeInbox(notifications);
    expect(serialized.items).toHaveLength(100);
  });
});

describe('serializePreferences', () => {
  it('serializes preferences object', () => {
    const prefs: NotificationPreferences = {
      transaction: false,
      credit_line: true,
      risk_score: false,
      rate_change: true,
      system: false,
    };
    const serialized = serializePreferences(prefs);
    expect(serialized).toEqual(prefs);
  });
});

describe('fuzz: hostile values', () => {
  const hostileValues = [
    null,
    undefined,
    'string',
    123,
    0,
    -1,
    NaN,
    Infinity,
    true,
    false,
    {},
    [],
    [null],
    [undefined],
    [{}],
    [{ id: 1 }],
    [{ id: 'a', type: 'success', category: 'transaction', title: 't', message: 'm', timestamp: 'x', read: false }],
    { v: 1, items: 'not array' },
    { v: 2, items: [] },
    { v: '1', items: [] },
    { items: [] }, // missing version
    { v: 1, items: [{ id: '1' }] }, // incomplete notification
    { v: 1, items: [{ id: '1', type: 'success', category: 'transaction', title: 't', message: 'm', timestamp: new Date().toISOString(), read: 'false' }] }, // read is string
    { v: 1, items: [{ id: '1', type: 'success', category: 'transaction', title: 't', message: 'm', timestamp: 'invalid', read: false }] }, // bad timestamp
  ];

  for (const value of hostileValues) {
    const desc = String(value).slice(0, 50);
    it(`parseInbox never throws for ${desc}`, () => {
      expect(() => parseInbox(value)).not.toThrow();
      expect(Array.isArray(parseInbox(value))).toBe(true);
    });

    it(`parsePreferences never throws for ${desc}`, () => {
      expect(() => parsePreferences(value)).not.toThrow();
      const result = parsePreferences(value);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });
  }
});