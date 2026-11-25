/**
 * Tests for classifyWalletError helper
 * 
 * Verifies that raw wallet extension errors are correctly classified into
 * typed WalletConnectError instances with appropriate user-facing messages.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyWalletError } from '../wallet';
import { WalletConnectError } from '../../types/wallet';

describe('classifyWalletError', () => {
  describe('user rejection detection', () => {
    it('classifies EIP-1193 code 4001 as user_rejected', () => {
      const error = { code: 4001, message: 'User rejected the request' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
      expect(result.message).toContain('cancelled');
    });

    it('classifies "User declined" message as user_rejected', () => {
      const error = new Error('User declined access');
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
      expect(result.message).toContain('cancelled');
    });

    it('classifies "rejected" message as user_rejected', () => {
      const error = { message: 'Transaction was rejected by user' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
    });

    it('classifies "cancel" message as user_rejected', () => {
      const error = { message: 'User cancelled the operation' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
    });

    it('classifies "denied" message as user_rejected', () => {
      const error = { message: 'Access denied by user' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
    });
  });

  describe('extension not found detection', () => {
    it('classifies "not found" message as not_found', () => {
      const error = new Error('Wallet extension not found');
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('not_found');
      expect(result.message).toContain('not found');
    });

    it('classifies "not installed" message as not_found', () => {
      const error = { message: 'Extension is not installed' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('not_found');
    });
  });

  describe('network mismatch detection', () => {
    it('classifies network-related message as wrong_network', () => {
      const error = new Error('Wrong network selected');
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('wrong_network');
      expect(result.message).toContain('Testnet');
    });

    it('classifies "testnet" message as wrong_network', () => {
      const error = { message: 'Please switch to Testnet' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('wrong_network');
    });

    it('classifies "mainnet" message as wrong_network', () => {
      const error = { message: 'Mainnet not supported' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('wrong_network');
    });
  });

  describe('generic connection failures', () => {
    it('classifies unknown error object as connection_failed', () => {
      const error = { message: 'Something went wrong' };
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('connection_failed');
      expect(result.message).toContain('Failed to connect');
    });

    it('classifies Error instance as connection_failed', () => {
      const error = new Error('Unexpected error');
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('connection_failed');
    });

    it('classifies string as connection_failed', () => {
      const error = 'Something went wrong';
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('connection_failed');
    });

    it('classifies null as connection_failed', () => {
      const error = null;
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('connection_failed');
    });

    it('classifies undefined as connection_failed', () => {
      const error = undefined;
      const result = classifyWalletError(error);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('connection_failed');
    });
  });

  describe('already-classified errors', () => {
    it('passes through WalletConnectError unchanged', () => {
      const original = new WalletConnectError('user_rejected', 'Custom message');
      const result = classifyWalletError(original);
      
      expect(result).toBe(original);
      expect(result.type).toBe('user_rejected');
      expect(result.message).toBe('Custom message');
    });
  });

  describe('legacy WalletError objects', () => {
    it('converts legacy WalletError object to WalletConnectError', () => {
      const legacyError = {
        type: 'not_found' as const,
        message: 'Wallet not found'
      };
      const result = classifyWalletError(legacyError);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('not_found');
      expect(result.message).toBe('Wallet not found');
    });

    it('converts legacy user_rejected error', () => {
      const legacyError = {
        type: 'user_rejected' as const,
        message: 'User rejected'
      };
      const result = classifyWalletError(legacyError);
      
      expect(result).toBeInstanceOf(WalletConnectError);
      expect(result.type).toBe('user_rejected');
    });
  });

  describe('Error instance checks', () => {
    it('creates Error instances that pass instanceof checks', () => {
      const error = { message: 'test error' };
      const result = classifyWalletError(error);
      
      expect(result instanceof Error).toBe(true);
      expect(result instanceof WalletConnectError).toBe(true);
    });

    it('preserves Error prototype chain', () => {
      const error = new Error('test');
      const result = classifyWalletError(error);
      
      expect(result.name).toBe('WalletConnectError');
      expect(result.stack).toBeDefined();
    });
  });

  describe('case-insensitive matching', () => {
    it('matches rejection keywords case-insensitively', () => {
      const error = { message: 'USER REJECTED THE REQUEST' };
      const result = classifyWalletError(error);
      
      expect(result.type).toBe('user_rejected');
    });

    it('matches not found case-insensitively', () => {
      const error = { message: 'Wallet NOT FOUND' };
      const result = classifyWalletError(error);
      
      expect(result.type).toBe('not_found');
    });
  });

  describe('development logging', () => {
    // A sentinel secret placed inside the raw error's message and fields.
    // Nothing written to console.error during classification may contain it.
    const SECRET = 'SENTINEL_SECRET_DO_NOT_LEAK_7Q3XZ9A1';

    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it('does not log when no code is present', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      classifyWalletError({ message: `Something went wrong: ${SECRET}` });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('logs only the code and resulting type, never the raw object or message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      classifyWalletError({ code: 4001, message: 'User rejected the request' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const [label, payload] = consoleErrorSpy.mock.calls[0];
      expect(label).toBe('[classifyWalletError]');
      expect(payload).toEqual({ code: 4001, type: 'user_rejected' });
    });

    it('does not leak a sentinel secret placed in the raw error message and fields', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const raw = {
        code: 4001,
        message: `User rejected the request: ${SECRET}`,
        account: SECRET,
        secretKey: SECRET,
        data: { nested: SECRET },
      };

      classifyWalletError(raw);

      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(SECRET);
    });

    it('does not leak the secret when classification falls back to message matching', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const raw = {
        code: 5000,
        message: `rejected: ${SECRET}`,
        account: SECRET,
      };

      classifyWalletError(raw);

      expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(SECRET);
    });
  });
});
