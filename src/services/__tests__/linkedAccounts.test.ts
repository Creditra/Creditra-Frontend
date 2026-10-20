/**
 * Tests for linkedAccounts service
 * 
 * Covers:
 * - Fetching linked accounts
 * - Initiating OAuth flow
 * - Completing OAuth callback
 * - Disconnecting accounts
 * - Reconnecting accounts
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchLinkedAccounts,
  initiateLinkAccount,
  completeOAuthLink,
  disconnectAccount,
  reconnectAccount,
  verifyAccount,
  PROVIDER_INFO,
} from '../linkedAccounts';
import * as storage from '../../utils/storage';
import type { LinkedAccount } from '../../types/linkedAccount';

// Mock storage utilities
vi.mock('../../utils/storage', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  removeKey: vi.fn(),
}));

describe('linkedAccounts service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchLinkedAccounts', () => {
    it('should fetch and return linked accounts', async () => {
      const mockAccounts: LinkedAccount[] = [
        {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Google User',
          externalId: 'user@gmail.com',
          connectedAt: '2026-01-01T00:00:00Z',
          lastVerified: '2026-06-28T00:00:00Z',
        },
      ];

      vi.mocked(storage.readJson).mockReturnValue(mockAccounts);

      const promise = fetchLinkedAccounts();
      vi.advanceTimersByTime(800);
      const result = await promise;

      expect(result).toEqual(mockAccounts);
      expect(storage.readJson).toHaveBeenCalledWith('creditra:linked-accounts', []);
    });

    it('should filter out disconnected accounts', async () => {
      const mockAccounts: LinkedAccount[] = [
        {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Google User',
          externalId: 'user@gmail.com',
          connectedAt: '2026-01-01T00:00:00Z',
        },
        {
          id: 'github-456',
          provider: 'github',
          status: 'disconnected',
          displayName: 'GitHub User',
          externalId: 'user@github.com',
          connectedAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(storage.readJson).mockReturnValue(mockAccounts);

      const promise = fetchLinkedAccounts();
      vi.advanceTimersByTime(800);
      const result = await promise;

      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe('google');
    });

    it('should handle fetch errors', async () => {
      vi.mocked(storage.readJson).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const promise = fetchLinkedAccounts();
      vi.advanceTimersByTime(800);

      await expect(promise).rejects.toThrow('Failed to fetch linked accounts');
    });
  });

  describe('initiateLinkAccount', () => {
    it('should initiate OAuth flow for new provider', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = initiateLinkAccount({ provider: 'google' });
      vi.advanceTimersByTime(400);
      const result = await promise;

      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain('/oauth/google');
      expect(result.authUrl).toContain('state=');
      expect(storage.writeJson).toHaveBeenCalledWith('creditra:oauth-state', expect.objectContaining({
        state: expect.any(String),
        provider: 'google',
        timestamp: expect.any(Number),
      }));
    });

    it('should reject if provider is already linked', async () => {
      const existingAccount: LinkedAccount = {
        id: 'google-123',
        provider: 'google',
        status: 'connected',
        displayName: 'Google User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([existingAccount]);

      const promise = initiateLinkAccount({ provider: 'google' });
      vi.advanceTimersByTime(400);

      await expect(promise).rejects.toMatchObject({
        code: 'already_linked',
        message: expect.stringContaining('already linked'),
      });
    });

    it('should include redirect URL in OAuth URL', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = initiateLinkAccount({
        provider: 'github',
        redirectUrl: '/settings/accounts',
      });
      vi.advanceTimersByTime(400);
      const result = await promise;

      expect(result.authUrl).toContain('redirect=%2Fsettings%2Faccounts');
    });
  });

  describe('completeOAuthLink', () => {
    it('should complete OAuth flow and create linked account', async () => {
      const stateData = {
        state: 'valid-state-token',
        provider: 'google',
        timestamp: Date.now(),
      };

      vi.mocked(storage.readJson)
        .mockReturnValueOnce(stateData) // For state verification
        .mockReturnValueOnce([]); // For existing accounts

      const promise = completeOAuthLink({
        provider: 'google',
        code: 'auth-code-123',
        state: 'valid-state-token',
      });
      vi.advanceTimersByTime(800);
      const result = await promise;

      expect(result).toMatchObject({
        provider: 'google',
        status: 'connected',
        displayName: expect.any(String),
        externalId: expect.any(String),
      });
      expect(storage.writeJson).toHaveBeenCalledWith('creditra:linked-accounts', expect.arrayContaining([result]));
      expect(storage.writeJson).toHaveBeenCalledWith('creditra:oauth-state', null);
    });

    it('should reject with invalid state', async () => {
      vi.mocked(storage.readJson).mockReturnValue({
        state: 'different-state',
        provider: 'google',
        timestamp: Date.now(),
      });

      const promise = completeOAuthLink({
        provider: 'google',
        code: 'auth-code-123',
        state: 'invalid-state',
      });
      vi.advanceTimersByTime(800);

      await expect(promise).rejects.toMatchObject({
        code: 'auth_failed',
        message: expect.stringContaining('Invalid OAuth state'),
      });
    });

    it('should reject with expired state', async () => {
      const expiredTime = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      
      vi.mocked(storage.readJson).mockReturnValue({
        state: 'valid-state',
        provider: 'google',
        timestamp: expiredTime,
      });

      const promise = completeOAuthLink({
        provider: 'google',
        code: 'auth-code-123',
        state: 'valid-state',
      });
      vi.advanceTimersByTime(800);

      await expect(promise).rejects.toMatchObject({
        code: 'token_expired',
        message: expect.stringContaining('expired'),
      });
    });

    it('should reject with mismatched provider', async () => {
      vi.mocked(storage.readJson).mockReturnValue({
        state: 'valid-state',
        provider: 'github',
        timestamp: Date.now(),
      });

      const promise = completeOAuthLink({
        provider: 'google',
        code: 'auth-code-123',
        state: 'valid-state',
      });
      vi.advanceTimersByTime(800);

      await expect(promise).rejects.toMatchObject({
        code: 'auth_failed',
      });
    });
  });

  describe('disconnectAccount', () => {
    it('should disconnect an existing account', async () => {
      const mockAccounts: LinkedAccount[] = [
        {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Google User',
          externalId: 'user@gmail.com',
          connectedAt: '2026-01-01T00:00:00Z',
        },
      ];

      vi.mocked(storage.readJson).mockReturnValue(mockAccounts);

      const promise = disconnectAccount('google-123');
      vi.advanceTimersByTime(600);
      await promise;

      expect(storage.writeJson).toHaveBeenCalledWith('creditra:linked-accounts', [
        expect.objectContaining({
          id: 'google-123',
          status: 'disconnected',
        }),
      ]);
    });

    it('should throw error if account not found', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = disconnectAccount('nonexistent-id');
      vi.advanceTimersByTime(600);

      await expect(promise).rejects.toThrow('Account not found');
    });
  });

  describe('reconnectAccount', () => {
    it('should initiate reconnection for existing account', async () => {
      const mockAccount: LinkedAccount = {
        id: 'google-123',
        provider: 'google',
        status: 'error',
        displayName: 'Google User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00Z',
      };

      vi.mocked(storage.readJson)
        .mockReturnValueOnce([mockAccount]) // For finding account
        .mockReturnValueOnce([mockAccount]); // For checking already linked

      const promise = reconnectAccount('google-123');
      await vi.advanceTimersByTimeAsync(800);
      const result = await promise;

      expect(result).toHaveProperty('authUrl');
      expect(result.authUrl).toContain('/oauth/google');
    });

    it('should throw error if account not found', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = reconnectAccount('nonexistent-id');
      vi.advanceTimersByTime(400);

      await expect(promise).rejects.toThrow('Account not found');
    });
  });

  describe('verifyAccount', () => {
    it('should verify and update account timestamp', async () => {
      const mockAccount: LinkedAccount = {
        id: 'google-123',
        provider: 'google',
        status: 'connected',
        displayName: 'Google User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00Z',
        lastVerified: '2026-06-01T00:00:00Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([mockAccount]);
      // Mock Math.random to always succeed verification
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const originalLastVerified = mockAccount.lastVerified;

      const promise = verifyAccount('google-123');
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result.status).toBe('connected');
      expect(new Date(result.lastVerified).getTime()).not.toBe(new Date(mockAccount.lastVerified).getTime());
      expect(storage.writeJson).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      const mockAccount: LinkedAccount = {
        id: 'google-123',
        provider: 'google',
        status: 'connected',
        displayName: 'Google User',
        externalId: 'user@gmail.com',
        connectedAt: '2026-01-01T00:00:00Z',
      };

      vi.mocked(storage.readJson).mockReturnValue([mockAccount]);
      // Mock Math.random to trigger verification failure
      vi.spyOn(Math, 'random').mockReturnValue(0.05);

      const promise = verifyAccount('google-123');
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('provider_error');
    });

    it('should throw error if account not found', async () => {
      vi.mocked(storage.readJson).mockReturnValue([]);

      const promise = verifyAccount('nonexistent-id');
      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Account not found');
    });
  });

  describe('PROVIDER_INFO', () => {
    it('should have info for all supported providers', () => {
      expect(PROVIDER_INFO).toHaveProperty('google');
      expect(PROVIDER_INFO).toHaveProperty('github');
      expect(PROVIDER_INFO).toHaveProperty('twitter');
      expect(PROVIDER_INFO).toHaveProperty('facebook');

      Object.values(PROVIDER_INFO).forEach(info => {
        expect(info).toHaveProperty('name');
        expect(info).toHaveProperty('icon');
        expect(info).toHaveProperty('color');
      });
    });
  });
});
