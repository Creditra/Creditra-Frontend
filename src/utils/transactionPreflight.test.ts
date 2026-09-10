import { describe, it, expect } from 'vitest';
import {
  normalizeNetwork,
  isNetworkMatching,
  isAccountMatching,
  evaluatePreflight,
  getPreflightIdentityKey,
} from './transactionPreflight';
import type { WalletInfo } from '../types/wallet';

describe('transactionPreflight utils', () => {
  const mockWallet: WalletInfo = {
    type: 'freighter',
    publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    network: 'TESTNET',
  };

  describe('normalizeNetwork', () => {
    it('normalizes testnet variations to TESTNET', () => {
      expect(normalizeNetwork('testnet')).toBe('TESTNET');
      expect(normalizeNetwork('TESTNET')).toBe('TESTNET');
      expect(normalizeNetwork(' testnet ')).toBe('TESTNET');
    });

    it('normalizes public and mainnet to PUBLIC', () => {
      expect(normalizeNetwork('public')).toBe('PUBLIC');
      expect(normalizeNetwork('PUBLIC')).toBe('PUBLIC');
      expect(normalizeNetwork('mainnet')).toBe('PUBLIC');
      expect(normalizeNetwork('MAINNET')).toBe('PUBLIC');
    });

    it('handles empty or undefined values', () => {
      expect(normalizeNetwork(null)).toBe('');
      expect(normalizeNetwork(undefined)).toBe('');
      expect(normalizeNetwork('')).toBe('');
    });
  });

  describe('isNetworkMatching', () => {
    it('returns true for matching normalized networks', () => {
      expect(isNetworkMatching('TESTNET', 'testnet')).toBe(true);
      expect(isNetworkMatching('public', 'MAINNET')).toBe(true);
    });

    it('returns false for mismatched networks', () => {
      expect(isNetworkMatching('PUBLIC', 'TESTNET')).toBe(false);
      expect(isNetworkMatching('testnet', 'public')).toBe(false);
    });

    it('returns false when either argument is missing', () => {
      expect(isNetworkMatching(null, 'TESTNET')).toBe(false);
      expect(isNetworkMatching('TESTNET', null)).toBe(false);
    });
  });

  describe('isAccountMatching', () => {
    it('returns true when no expected account is configured', () => {
      expect(isAccountMatching(mockWallet.publicKey, undefined)).toBe(true);
      expect(isAccountMatching(mockWallet.publicKey, null)).toBe(true);
      expect(isAccountMatching(mockWallet.publicKey, '')).toBe(true);
    });

    it('returns true when connected account matches expected account', () => {
      expect(isAccountMatching(mockWallet.publicKey, mockWallet.publicKey)).toBe(true);
      expect(isAccountMatching(` ${mockWallet.publicKey} `, mockWallet.publicKey)).toBe(true);
    });

    it('returns false when accounts do not match', () => {
      const otherAccount = 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC';
      expect(isAccountMatching(mockWallet.publicKey, otherAccount)).toBe(false);
    });

    it('returns false when connected account is missing and expected is required', () => {
      expect(isAccountMatching(null, mockWallet.publicKey)).toBe(false);
    });
  });

  describe('evaluatePreflight', () => {
    it('blocks signing when wallet is disconnected', () => {
      const result = evaluatePreflight({
        wallet: null,
        status: 'disconnected',
        expectedNetwork: 'TESTNET',
      });

      expect(result.canSign).toBe(false);
      expect(result.status).toBe('disconnected');
      expect(result.blockReason).toContain('disconnected');
    });

    it('blocks signing when wallet status is connecting or error', () => {
      const result = evaluatePreflight({
        wallet: mockWallet,
        status: 'connecting',
        expectedNetwork: 'TESTNET',
      });

      expect(result.canSign).toBe(false);
      expect(result.status).toBe('disconnected');
    });

    it('blocks signing when connected to wrong network', () => {
      const wrongNetworkWallet: WalletInfo = {
        ...mockWallet,
        network: 'PUBLIC',
      };

      const result = evaluatePreflight({
        wallet: wrongNetworkWallet,
        status: 'connected',
        expectedNetwork: 'TESTNET',
      });

      expect(result.canSign).toBe(false);
      expect(result.status).toBe('wrong_network');
      expect(result.isNetworkMatch).toBe(false);
      expect(result.blockReason).toContain('Wrong network');
      expect(result.connectedNetwork).toBe('PUBLIC');
      expect(result.expectedNetwork).toBe('TESTNET');
    });

    it('blocks signing when expected account does not match connected account', () => {
      const expectedAccount = 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC';

      const result = evaluatePreflight({
        wallet: mockWallet,
        status: 'connected',
        expectedNetwork: 'TESTNET',
        expectedAccount,
      });

      expect(result.canSign).toBe(false);
      expect(result.status).toBe('account_mismatch');
      expect(result.isAccountMatch).toBe(false);
      expect(result.blockReason).toContain('Account mismatch');
    });

    it('blocks signing when wallet identity key indicates stale state', () => {
      const initialKey = getPreflightIdentityKey(mockWallet);
      const switchedWallet: WalletInfo = {
        ...mockWallet,
        publicKey: 'GCAL45EPMU6J2GY4HQHCHYF5H7GYZRFV2Z7X7V4XQGJJJFX65G5M6PQC',
      };

      const result = evaluatePreflight({
        wallet: switchedWallet,
        status: 'connected',
        expectedNetwork: 'TESTNET',
        initialIdentityKey: initialKey,
      });

      expect(result.canSign).toBe(false);
      expect(result.status).toBe('stale_identity');
      expect(result.isIdentityFresh).toBe(false);
      expect(result.blockReason?.toLowerCase()).toContain('stale');
    });

    it('allows signing when network, account, and identity are valid', () => {
      const initialKey = getPreflightIdentityKey(mockWallet);

      const result = evaluatePreflight({
        wallet: mockWallet,
        status: 'connected',
        expectedNetwork: 'TESTNET',
        expectedAccount: mockWallet.publicKey,
        initialIdentityKey: initialKey,
      });

      expect(result.canSign).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.isNetworkMatch).toBe(true);
      expect(result.isAccountMatch).toBe(true);
      expect(result.isIdentityFresh).toBe(true);
      expect(result.blockReason).toBeNull();
    });
  });
});
