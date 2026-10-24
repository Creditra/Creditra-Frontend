import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  scopedKey,
  hashAddress,
  hashAddressSync,
  migrateLegacyStorage,
  useScopedStorage,
  MIGRATION_FLAG_KEY,
} from '../scoped-storage';
import { WalletProvider } from '../../context/WalletContext';
import type { WalletInfo } from '../../types/wallet';

describe('scoped-storage', () => {
  const WALLET_A = 'GBRPYHIL2CI3FNQ4AFJMFKOBOMU3FO244DCISFO3ZHSXZSSVU2ZBXA2T';
  const WALLET_B = 'GCKF7HQPO2AFUJG5GNO6MQ2TNPZZQ4H7Z4KTYL3QG3FGLO352YOH5YTR';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('scopedKey and hashing', () => {
    it('returns ${base}::${hash(address)} when wallet address is provided', () => {
      const key = scopedKey('creditra_notifications', WALLET_A);
      expect(key).toMatch(/^creditra_notifications::[0-9a-f]{12}$/);
    });

    it('Scenario 8: key name never contains the 56-character G... address', () => {
      const keyA = scopedKey('creditra_notifications', WALLET_A);
      const keyB = scopedKey('creditra:linked-accounts', WALLET_B);

      expect(keyA).not.toContain(WALLET_A);
      expect(keyA).not.toMatch(/G[A-Z0-9]{55}/);
      expect(keyB).not.toContain(WALLET_B);
      expect(keyB).not.toMatch(/G[A-Z0-9]{55}/);
    });

    it('returns identical keys for identical address (deterministic)', () => {
      const key1 = scopedKey('creditra_channel_prefs', WALLET_A);
      const key2 = scopedKey('creditra_channel_prefs', WALLET_A);
      expect(key1).toBe(key2);
    });

    it('returns different keys for different addresses', () => {
      const keyA = scopedKey('creditra_notifications', WALLET_A);
      const keyB = scopedKey('creditra_notifications', WALLET_B);
      expect(keyA).not.toBe(keyB);
    });

    it('returns base key when address is null or undefined', () => {
      expect(scopedKey('creditra_notifications', null)).toBe('creditra_notifications');
      expect(scopedKey('creditra_notifications', undefined)).toBe('creditra_notifications');
      expect(scopedKey('creditra_notifications', '')).toBe('creditra_notifications');
    });

    it('sync fallback hash produces identical prefix to crypto.subtle digest', async () => {
      const syncPrefix = hashAddressSync(WALLET_A);
      const asyncPrefix = await hashAddress(WALLET_A);
      expect(syncPrefix).toBe(asyncPrefix);
      expect(syncPrefix).toHaveLength(12);
    });
  });

  describe('Migration', () => {
    it('Scenario 6: Upgrade with existing global keys, first connect as A moves data to A scope and removes global keys', () => {
      localStorage.setItem('creditra_notifications', JSON.stringify([{ id: '1', title: 'Old global' }]));
      localStorage.setItem('creditra_notification_prefs', JSON.stringify({ system: false }));
      localStorage.setItem('creditra:linked-accounts', JSON.stringify([{ id: 'gh-1', provider: 'github' }]));
      localStorage.setItem('creditra_channel_prefs', JSON.stringify({ repayment_due: { email: false } }));

      migrateLegacyStorage(WALLET_A);

      // Global keys removed
      expect(localStorage.getItem('creditra_notifications')).toBeNull();
      expect(localStorage.getItem('creditra_notification_prefs')).toBeNull();
      expect(localStorage.getItem('creditra:linked-accounts')).toBeNull();
      expect(localStorage.getItem('creditra_channel_prefs')).toBeNull();

      // Scoped keys created under A
      const scopedNotifications = localStorage.getItem(scopedKey('creditra_notifications', WALLET_A));
      expect(scopedNotifications).toBe(JSON.stringify([{ id: '1', title: 'Old global' }]));

      const scopedAccounts = localStorage.getItem(scopedKey('creditra:linked-accounts', WALLET_A));
      expect(scopedAccounts).toBe(JSON.stringify([{ id: 'gh-1', provider: 'github' }]));

      // Migration marker set
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('true');
    });

    it('Scenario 7: Second connect as B after migration starts empty with no second migration', () => {
      localStorage.setItem('creditra_notifications', JSON.stringify([{ id: '1', title: 'Old global' }]));

      // Connect as A first
      migrateLegacyStorage(WALLET_A);
      expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('true');

      // Now connect as B
      migrateLegacyStorage(WALLET_B);

      // B has no data
      expect(localStorage.getItem(scopedKey('creditra_notifications', WALLET_B))).toBeNull();
      // A still has its data
      expect(localStorage.getItem(scopedKey('creditra_notifications', WALLET_A))).not.toBeNull();
    });

    it('is safe to interrupt and does not throw', () => {
      expect(() => migrateLegacyStorage('')).not.toThrow();
      expect(() => migrateLegacyStorage(WALLET_A)).not.toThrow();
    });

    it('Scenario 9: Theme and contrast keys remain untouched and global', () => {
      localStorage.setItem('creditra-theme', 'dark');
      localStorage.setItem('creditra-contrast', 'high');

      migrateLegacyStorage(WALLET_A);

      expect(localStorage.getItem('creditra-theme')).toBe('dark');
      expect(localStorage.getItem('creditra-contrast')).toBe('high');
      expect(localStorage.getItem(scopedKey('creditra-theme', WALLET_A))).toBeNull();
      expect(localStorage.getItem(scopedKey('creditra-contrast', WALLET_A))).toBeNull();
    });
  });

  describe('useScopedStorage', () => {
    const walletA: WalletInfo = {
      publicKey: WALLET_A,
      type: 'freighter',
      network: 'testnet',
    };
    const walletB: WalletInfo = {
      publicKey: WALLET_B,
      type: 'freighter',
      network: 'testnet',
    };

    const defaultPrefs = { email: true, sms: true, push: true };

    it('Scenario 4: Channel prefs changed under A, B sees defaults', () => {
      const wrapperA = ({ children }: { children: React.ReactNode }) =>
        React.createElement(WalletProvider, { initialWallet: walletA, children });
      const wrapperB = ({ children }: { children: React.ReactNode }) =>
        React.createElement(WalletProvider, { initialWallet: walletB, children });

      const { result } = renderHook(
        () => useScopedStorage(scopedKey('creditra_channel_prefs'), defaultPrefs),
        { wrapper: wrapperA },
      );

      expect(result.current[0]).toEqual(defaultPrefs);

      // Change channel prefs under A
      act(() => {
        result.current[1]({ email: false, sms: true, push: true });
      });

      expect(result.current[0]).toEqual({ email: false, sms: true, push: true });
      expect(localStorage.getItem(scopedKey('creditra_channel_prefs', WALLET_A))).not.toBeNull();

      // Switch to B -> B sees defaults
      const { result: resultB } = renderHook(
        () => useScopedStorage(scopedKey('creditra_channel_prefs'), defaultPrefs),
        { wrapper: wrapperB },
      );

      expect(resultB.current[0]).toEqual(defaultPrefs);
    });

    it('Scenario 5: Disconnected state returns fallback and suppresses storage writes', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(WalletProvider, { initialWallet: null, children });

      const { result } = renderHook(
        () => useScopedStorage(scopedKey('creditra_channel_prefs'), defaultPrefs),
        { wrapper },
      );

      expect(result.current[0]).toEqual(defaultPrefs);

      act(() => {
        result.current[1]({ email: false, sms: false, push: false });
      });

      // Storage has nothing written
      expect(localStorage.length).toBe(0);
    });
  });
});
