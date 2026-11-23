import { describe, it, expect, beforeEach } from 'vitest';
import {
  readJson,
  writeJson,
  removeKey,
  hasKey,
  readVersioned,
  writeVersioned,
  registerStorageMigration,
  getStorageMigration,
  clearStorageMigrations,
} from './storage';

describe('storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearStorageMigrations();
  });

  it('round-trips JSON values through write/read', () => {
    writeJson('user', { name: 'Ada', age: 36 });
    expect(readJson('user', null)).toEqual({ name: 'Ada', age: 36 });
  });

  it('returns the fallback when the key is missing', () => {
    expect(readJson('missing', 'fallback-value')).toBe('fallback-value');
  });

  it('returns the fallback when the stored value is malformed JSON', () => {
    window.localStorage.setItem('broken', '{not json');
    expect(readJson('broken', 42)).toBe(42);
  });

  it('removes a key', () => {
    writeJson('temp', { ok: true });
    removeKey('temp');
    expect(window.localStorage.getItem('temp')).toBeNull();
  });

  it('checks key existence with hasKey', () => {
    expect(hasKey('absent')).toBe(false);
    writeJson('present', 1);
    expect(hasKey('present')).toBe(true);
  });
});

describe('versioned storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearStorageMigrations();
  });

  it('writes and reads a { v, data } envelope', () => {
    writeVersioned('prefs', { theme: 'dark' }, { version: 1 });
    expect(JSON.parse(window.localStorage.getItem('prefs')!)).toEqual({
      v: 1,
      data: { theme: 'dark' },
    });

    const result = readVersioned('prefs', {
      version: 1,
      fallback: { theme: 'light' },
    });
    expect(result).toEqual({ theme: 'dark' });
  });

  it('migrates legacy unversioned JSON values once and rewrites as envelope', () => {
    window.localStorage.setItem('metrics', JSON.stringify({ score: 720 }));

    const result = readVersioned('metrics', {
      version: 1,
      fallback: { score: 0 },
      migrate: (raw, fromVersion) => {
        expect(fromVersion).toBe(0);
        if (raw && typeof raw === 'object' && 'score' in raw) {
          return raw as { score: number };
        }
        return undefined;
      },
    });

    expect(result).toEqual({ score: 720 });
    expect(JSON.parse(window.localStorage.getItem('metrics')!)).toEqual({
      v: 1,
      data: { score: 720 },
    });
  });

  it('migrates legacy raw non-JSON strings once and rewrites as envelope', () => {
    window.localStorage.setItem('terms_ver', '2026-07');

    const result = readVersioned<string | null>('terms_ver', {
      version: 1,
      fallback: null,
      migrate: (raw, fromVersion) => {
        expect(fromVersion).toBe(0);
        return typeof raw === 'string' ? raw : undefined;
      },
    });

    expect(result).toBe('2026-07');
    expect(JSON.parse(window.localStorage.getItem('terms_ver')!)).toEqual({
      v: 1,
      data: '2026-07',
    });
  });

  it('migrates older versioned envelopes to the target version', () => {
    writeVersioned('profile', { fullName: 'Ada Lovelace' }, { version: 1 });

    const result = readVersioned('profile', {
      version: 2,
      fallback: { firstName: '', lastName: '' },
      migrate: (raw, fromVersion) => {
        if (fromVersion === 1 && raw && typeof raw === 'object' && 'fullName' in raw) {
          const [firstName, lastName = ''] = String((raw as { fullName: string }).fullName).split(' ');
          return { firstName, lastName };
        }
        return undefined;
      },
    });

    expect(result).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(JSON.parse(window.localStorage.getItem('profile')!)).toEqual({
      v: 2,
      data: { firstName: 'Ada', lastName: 'Lovelace' },
    });
  });

  it('uses the migration registry when options.migrate is omitted', () => {
    registerStorageMigration('registered_key', {
      version: 2,
      migrate: (raw, fromVersion) => {
        if (fromVersion === 1 && typeof raw === 'number') {
          return raw * 2;
        }
        return undefined;
      },
    });

    expect(getStorageMigration('registered_key')?.version).toBe(2);

    writeVersioned('registered_key', 21, { version: 1 });
    const result = readVersioned('registered_key', {
      version: 2,
      fallback: 0,
    });

    expect(result).toBe(42);
    expect(JSON.parse(window.localStorage.getItem('registered_key')!)).toEqual({
      v: 2,
      data: 42,
    });
  });

  it('ignores unknown future versions safely without overwriting storage', () => {
    const futureRaw = JSON.stringify({ v: 99, data: { futureField: true } });
    window.localStorage.setItem('future_key', futureRaw);

    const result = readVersioned('future_key', {
      version: 1,
      fallback: { safe: true },
    });

    expect(result).toEqual({ safe: true });
    expect(window.localStorage.getItem('future_key')).toBe(futureRaw);
  });

  it('falls back safely on corrupt JSON, failed validation, or throwing migration', () => {
    window.localStorage.setItem('corrupt', '{bad json');
    expect(readVersioned('corrupt', { version: 1, fallback: 'default' })).toBe('default');

    writeVersioned('invalid_shape', { wrong: true }, { version: 1 });
    expect(
      readVersioned('invalid_shape', {
        version: 1,
        fallback: { expected: 1 },
        validate: (d): d is { expected: number } =>
          !!d && typeof d === 'object' && typeof (d as { expected?: unknown }).expected === 'number',
      }),
    ).toEqual({ expected: 1 });

    window.localStorage.setItem('throws', JSON.stringify({ legacy: true }));
    expect(
      readVersioned('throws', {
        version: 1,
        fallback: 'safe',
        migrate: () => {
          throw new Error('boom');
        },
      }),
    ).toBe('safe');
  });
});
