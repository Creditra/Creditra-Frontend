import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseLinkedAccount,
  createLinkedAccountsService,
  fetchLinkedAccounts,
  disconnectAccount,
} from '../linkedAccounts';
import * as storage from '../../utils/storage';
import type { LinkedAccount } from '../../types/linkedAccount';

vi.mock('../../utils/storage', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
}));

describe('Linked Accounts Schema & Determinism', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Scenario 1: Verify with failure policy off', () => {
    it('always connected; lastVerified equals injected now', async () => {
      const fixedNow = 1767225600000;
      const service = createLinkedAccountsService({
        now: () => fixedNow,
        shouldFailVerification: () => false,
        storage: {
          readJson: storage.readJson,
          writeJson: storage.writeJson,
        },
      });

      const mockAccount: LinkedAccount = {
        id: 'google-1',
        provider: 'google',
        status: 'connected',
        displayName: 'User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([mockAccount]);

      const promise = service.verifyAccount('google-1');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.status).toBe('connected');
      expect(result.lastVerified).toBe(new Date(fixedNow).toISOString());
      expect(result.error).toBeUndefined();
    });
  });

  describe('Scenario 2: Verify with policy forcing failure', () => {
    it('status error, error code provider_error', async () => {
      const fixedNow = 1767225600000;
      const service = createLinkedAccountsService({
        now: () => fixedNow,
        shouldFailVerification: () => true,
        storage: {
          readJson: storage.readJson,
          writeJson: storage.writeJson,
        },
      });

      const mockAccount: LinkedAccount = {
        id: 'google-1',
        provider: 'google',
        status: 'connected',
        displayName: 'User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([mockAccount]);

      const promise = service.verifyAccount('google-1');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('provider_error');
      expect(result.lastVerified).toBe(new Date(fixedNow).toISOString());
    });
  });

  describe('Scenario 3: Two links in the same now', () => {
    it('distinct ids from randomId', async () => {
      let callCount = 0;
      const ids = ['uuid-first', 'uuid-second'];
      const fixedNow = 1767225600000;

      const service = createLinkedAccountsService({
        now: () => fixedNow,
        randomId: () => ids[callCount++],
        storage: {
          readJson: storage.readJson,
          writeJson: storage.writeJson,
        },
      });

      const stateData = {
        state: 'valid-state',
        provider: 'google',
        timestamp: fixedNow,
      };

      vi.mocked(storage.readJson)
        .mockReturnValueOnce(stateData)
        .mockReturnValueOnce([])
        .mockReturnValueOnce(stateData)
        .mockReturnValueOnce([]);

      const p1 = service.completeOAuthLink({
        provider: 'google',
        code: 'code-1',
        state: 'valid-state',
      });
      const p2 = service.completeOAuthLink({
        provider: 'google',
        code: 'code-2',
        state: 'valid-state',
      });

      await vi.advanceTimersByTimeAsync(800);
      const [res1, res2] = await Promise.all([p1, p2]);

      expect(res1.id).not.toBe(res2.id);
      expect(res1.id).toContain('uuid-first');
      expect(res2.id).toContain('uuid-second');
      expect(res1.externalId).not.toBe(res2.externalId);
    });
  });

  describe('Scenario 4: Storage holds {}', () => {
    it('fetchLinkedAccounts returns [] and rewrites storage', async () => {
      vi.mocked(storage.readJson).mockReturnValue({} as any);

      const promise = fetchLinkedAccounts();
      await vi.advanceTimersByTimeAsync(800);
      const result = await promise;

      expect(result).toEqual([]);
      expect(storage.writeJson).toHaveBeenCalledWith('creditra:linked-accounts', []);
    });
  });

  describe('Scenario 5: Array with one invalid provider entry', () => {
    it('invalid entry dropped, valid ones returned', async () => {
      const validEntry: LinkedAccount = {
        id: 'valid-1',
        provider: 'google',
        status: 'connected',
        displayName: 'Valid User',
        externalId: 'valid@example.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
      };
      const invalidEntry = {
        id: 'invalid-1',
        provider: 'unsupported_provider',
        status: 'connected',
        displayName: 'Invalid Provider User',
        externalId: 'invalid@example.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([validEntry, invalidEntry]);

      const promise = fetchLinkedAccounts();
      await vi.advanceTimersByTimeAsync(800);
      const result = await promise;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('valid-1');
      expect(storage.writeJson).toHaveBeenCalledWith('creditra:linked-accounts', [validEntry]);
    });
  });

  describe('Scenario 6: Invalid connectedAt date', () => {
    it('entry dropped', () => {
      const rawWithBadDate = {
        id: 'bad-date-1',
        provider: 'google',
        status: 'connected',
        displayName: 'Bad Date User',
        externalId: 'bad@example.com',
        connectedAt: 'invalid-date-string',
      };

      expect(parseLinkedAccount(rawWithBadDate)).toBeNull();
    });

    it('entry with invalid lastVerified date dropped', () => {
      const rawWithBadLastVerified = {
        id: 'bad-date-2',
        provider: 'google',
        status: 'connected',
        displayName: 'Bad Date User',
        externalId: 'bad@example.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
        lastVerified: 'not-a-date',
      };

      expect(parseLinkedAccount(rawWithBadLastVerified)).toBeNull();
    });
  });

  describe('Scenario 7: Disconnect unknown id', () => {
    it('rejects with { code: "not_found" }', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = disconnectAccount('unknown-id');
      const assertion = expect(promise).rejects.toMatchObject({
        code: 'not_found',
        message: 'Account not found',
      });
      await vi.advanceTimersByTimeAsync(600);
      await assertion;
    });
  });

  describe('parseLinkedAccount edge cases', () => {
    it('returns null for primitives and non-objects', () => {
      expect(parseLinkedAccount(null)).toBeNull();
      expect(parseLinkedAccount(undefined)).toBeNull();
      expect(parseLinkedAccount('string')).toBeNull();
      expect(parseLinkedAccount(123)).toBeNull();
      expect(parseLinkedAccount([])).toBeNull();
    });

    it('returns null for missing or invalid fields', () => {
      expect(parseLinkedAccount({ id: '' })).toBeNull();
      expect(parseLinkedAccount({ id: '1', provider: 'google', status: 'invalid_status' })).toBeNull();
      expect(parseLinkedAccount({ id: '1', provider: 'google', status: 'connected', displayName: 123 })).toBeNull();
      expect(parseLinkedAccount({ id: '1', provider: 'google', status: 'connected', displayName: 'User', externalId: 123 })).toBeNull();
    });

    it('successfully parses valid account with error object', () => {
      const valid = {
        id: '1',
        provider: 'google',
        status: 'error',
        displayName: 'User',
        externalId: 'user@example.com',
        connectedAt: '2026-01-01T00:00:00.000Z',
        error: {
          code: 'provider_error',
          message: 'Error message',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      };

      const parsed = parseLinkedAccount(valid);
      expect(parsed).not.toBeNull();
      expect(parsed?.error?.code).toBe('provider_error');
      expect(parsed?.error?.timestamp).toBe('2026-01-01T00:00:00.000Z');
    });
  });
});
