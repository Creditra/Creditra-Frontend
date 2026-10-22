import { StrKey } from '@stellar/stellar-sdk';

export type CreditNetwork = 'TESTNET' | 'PUBLIC';

export interface CreditNetworkConfig {
  network: CreditNetwork;
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  creditContractId: string;
}

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid credit network configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

const TESTNET_PASSPHRASE = 'Test Stellar Network ; February 2015';
const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const DEFAULTS = {
  TESTNET: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET_PASSPHRASE
  },
  PUBLIC: {
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    networkPassphrase: PUBLIC_PASSPHRASE
  }
} as const;

function readEnv(key: string): string | undefined {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  const value = env?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isDevMode(): boolean {
  const env = (import.meta as { env?: Record<string, unknown> }).env;
  return env?.MODE === 'development';
}

function validateUrl(name: string, value: string, problems: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    problems.push(`${name} must be a valid URL (received "${value}").`);
    return;
  }

  if (parsed.protocol === 'https:') return;

  if (parsed.protocol === 'http:') {
    const isLocalhost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocalhost && isDevMode()) return;
    problems.push(
      `${name} must use https: (http is only allowed for localhost in development) (received "${value}").`
    );
    return;
  }

  problems.push(`${name} must use https: (received "${value}").`);
}

function validateContractId(value: string, problems: string[]): void {
  if (!value.startsWith('C')) {
    problems.push(`VITE_CREDIT_CONTRACT_ID must start with "C" (received "${value}").`);
    return;
  }
  if (value.length !== 56) {
    problems.push(
      `VITE_CREDIT_CONTRACT_ID must be 56 characters (received ${value.length}).`
    );
    return;
  }
  try {
    if (!StrKey.isValidContract(value)) {
      throw new Error('invalid contract strkey');
    }
    StrKey.decodeContract(value);
  } catch {
    problems.push(
      `VITE_CREDIT_CONTRACT_ID is not a valid strkey (bad checksum or encoding): "${value}".`
    );
  }
}

let cached: CreditNetworkConfig | undefined;

export function getCreditNetworkConfig(): CreditNetworkConfig {
  if (cached) return cached;

  const problems: string[] = [];

  const rawNetwork = readEnv('VITE_STELLAR_NETWORK');
  const network: CreditNetwork = rawNetwork ? (rawNetwork.toUpperCase() as CreditNetwork) : 'TESTNET';

  if (network !== 'TESTNET' && network !== 'PUBLIC') {
    problems.push(
      `VITE_STELLAR_NETWORK must be "TESTNET" or "PUBLIC" (received "${rawNetwork}").`
    );
  }

  const effectiveNetwork: CreditNetwork =
    network === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
  const defaults = DEFAULTS[effectiveNetwork];

  const horizonUrl = readEnv('VITE_HORIZON_URL') ?? defaults.horizonUrl;
  const sorobanRpcUrl = readEnv('VITE_SOROBAN_RPC_URL') ?? defaults.sorobanRpcUrl;
  const networkPassphrase =
    readEnv('VITE_STELLAR_NETWORK_PASSTHRASE') ?? defaults.networkPassphrase;
  const creditContractId = readEnv('VITE_CREDIT_CONTRACT_ID') ?? '';

  validateUrl('VITE_HORIZON_URL', horizonUrl, problems);
  validateUrl('VITE_SOROBAN_RPC_URL', sorobanRpcUrl, problems);

  const expectedPassphrase = DEFAULTS[effectiveNetwork].networkPassphrase;
  if (networkPassphrase !== expectedPassphrase) {
    problems.push(
      `VITE_STELLAR_NETWORK_PASSTHRASE does not match the ${effectiveNetwork} network. Expected "${expectedPassphrase}" but received "${networkPassphrase}".`
    );
  }

  if (creditContractId === '') {
    problems.push('VITE_CREDIT_CONTRACT_ID is required.');
  } else {
    validateContractId(creditContractId, problems);
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  cached = {
    network: effectiveNetwork,
    horizonUrl,
    sorobanRpcUrl,
    networkPassphrase,
    creditContractId
  };

  return cached;
}

export function resetCreditNetworkConfigForTests(): void {
  cached = undefined;
}
