import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfigError,
  getCreditNetworkConfig,
  resetCreditNetworkConfigForTests,
} from '../creditNetwork';

const VALID_CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

describe('getCreditNetworkConfig', () => {
  beforeEach(() => {
    resetCreditNetworkConfigForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetCreditNetworkConfigForTests();
  });

  it('defaults to TESTNET with matching network endpoints', () => {
    const config = getCreditNetworkConfig({});

    expect(config.network).toBe('TESTNET');
    expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.sorobanRpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(config.explorerBaseUrl).toBe('https://stellar.expert/explorer/testnet');
    expect(config.friendbotUrl).toBe('https://friendbot.stellar.org');
    expect(config.creditContractId).toBe('');
  });

  it('switches every derived endpoint to PUBLIC', () => {
    const config = getCreditNetworkConfig({
      VITE_STELLAR_NETWORK: 'public',
      VITE_STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
    });

    expect(config.network).toBe('PUBLIC');
    expect(config.horizonUrl).toBe('https://horizon.stellar.org');
    expect(config.sorobanRpcUrl).toBe('https://soroban.stellar.org');
    expect(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    expect(config.explorerBaseUrl).toBe('https://stellar.expert/explorer/public');
    expect(config.friendbotUrl).toBeUndefined();
  });

  it('rejects a passphrase that does not match the selected network', () => {
    expect(() =>
      getCreditNetworkConfig({
        VITE_STELLAR_NETWORK: 'PUBLIC',
        VITE_STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
      }),
    ).toThrow(ConfigError);
  });

  it('rejects an unsupported network name', () => {
    expect(() => getCreditNetworkConfig({ VITE_STELLAR_NETWORK: 'FUTURENET' })).toThrow(
      /must be "TESTNET" or "PUBLIC"/,
    );
  });

  it('rejects non-https endpoints', () => {
    expect(() =>
      getCreditNetworkConfig({ VITE_HORIZON_URL: 'ftp://horizon.example.com' }),
    ).toThrow(/VITE_HORIZON_URL must use https/);
  });

  it('allows http://localhost only in development', () => {
    expect(() =>
      getCreditNetworkConfig({ VITE_SOROBAN_RPC_URL: 'http://localhost:8000/soroban/rpc' }),
    ).toThrow(/http is only allowed for localhost in development/);

    resetCreditNetworkConfigForTests();

    expect(
      getCreditNetworkConfig({
        MODE: 'development',
        VITE_SOROBAN_RPC_URL: 'http://localhost:8000/soroban/rpc',
      }).sorobanRpcUrl,
    ).toBe('http://localhost:8000/soroban/rpc');
  });

  it('accepts a valid contract strkey', () => {
    expect(
      getCreditNetworkConfig({ VITE_CREDIT_CONTRACT_ID: VALID_CONTRACT_ID }).creditContractId,
    ).toBe(VALID_CONTRACT_ID);
  });

  it('rejects a malformed contract strkey', () => {
    expect(() =>
      getCreditNetworkConfig({
        VITE_CREDIT_CONTRACT_ID: `${VALID_CONTRACT_ID.slice(0, -1)}X`,
      }),
    ).toThrow(/not a valid strkey/);
  });

  it('warns when a legacy passphrase variable is still set', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    getCreditNetworkConfig({
      VITE_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
    });

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('VITE_NETWORK_PASSPHRASE is no longer read'),
    );
  });
});
