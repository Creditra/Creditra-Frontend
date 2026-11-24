import { StrKey } from '@stellar/stellar-sdk';

export type CreditNetwork = 'TESTNET' | 'PUBLIC';

export interface CreditNetworkConfig {
  network: CreditNetwork;
  horizonUrl: string;
  sorobanRpcUrl: string;
  networkPassphrase: string;
  /**
   * Deployed Creditra contract address.
   *
   * Optional here because the mock data source does not need a contract. The
   * Soroban data source treats an empty value as a configuration error (see
   * `src/services/credit/sorobanCreditDataSource.ts`).
   */
  creditContractId: string;
  /** Explorer root for the selected network, without a `/tx` suffix. */
  explorerBaseUrl: string;
  /** Friendbot funding endpoint. Testnet only; `undefined` on PUBLIC. */
  friendbotUrl?: string;
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

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

const DEFAULTS = {
  TESTNET: {
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: TESTNET_PASSPHRASE,
    explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  PUBLIC: {
    horizonUrl: 'https://horizon.stellar.org',
    sorobanRpcUrl: 'https://soroban.stellar.org',
    networkPassphrase: PUBLIC_PASSPHRASE,
    explorerBaseUrl: 'https://stellar.expert/explorer/public',
    friendbotUrl: undefined,
  },
} as const;

/**
 * Variable names that older builds read directly. They are ignored now; a
 * warning points contributors at the single supported spelling.
 */
const LEGACY_PASSPHRASE_ENV_VARS = [
  'VITE_STELLAR_NETWORK_PASSTHRASE',
  'VITE_NETWORK_PASSPHRASE',
] as const;

type CreditNetworkEnv = Record<string, unknown>;

function defaultEnv(): CreditNetworkEnv {
  return (import.meta as { env?: CreditNetworkEnv }).env ?? {};
}

function readEnv(env: CreditNetworkEnv, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function isDevMode(env: CreditNetworkEnv): boolean {
  return env.MODE === 'development';
}

function warnAboutLegacyEnvVars(env: CreditNetworkEnv): void {
  for (const key of LEGACY_PASSPHRASE_ENV_VARS) {
    if (readEnv(env, key) !== undefined) {
      console.warn(
        `[creditNetwork] ${key} is no longer read. Use VITE_STELLAR_NETWORK_PASSPHRASE instead.`
      );
    }
  }
}

function validateUrl(
  name: string,
  value: string,
  problems: string[],
  env: CreditNetworkEnv,
): void {
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
    if (isLocalhost && isDevMode(env)) return;
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

/**
 * Resolve the single Stellar/Soroban network configuration used by Horizon,
 * Soroban RPC, wallet network checks and explorer links.
 *
 * Every problem found in the environment is reported together in one
 * `ConfigError`, so a misconfigured deploy fails loudly in one place rather
 * than silently pointing different subsystems at different networks.
 */
export function getCreditNetworkConfig(
  env: CreditNetworkEnv = defaultEnv(),
): CreditNetworkConfig {
  if (cached) return cached;

  const problems: string[] = [];

  warnAboutLegacyEnvVars(env);

  const rawNetwork = readEnv(env, 'VITE_STELLAR_NETWORK');
  const network: CreditNetwork = rawNetwork ? (rawNetwork.toUpperCase() as CreditNetwork) : 'TESTNET';

  if (network !== 'TESTNET' && network !== 'PUBLIC') {
    problems.push(
      `VITE_STELLAR_NETWORK must be "TESTNET" or "PUBLIC" (received "${rawNetwork}").`
    );
  }

  const effectiveNetwork: CreditNetwork =
    network === 'PUBLIC' ? 'PUBLIC' : 'TESTNET';
  const defaults = DEFAULTS[effectiveNetwork];

  const horizonUrl = readEnv(env, 'VITE_HORIZON_URL') ?? defaults.horizonUrl;
  const sorobanRpcUrl = readEnv(env, 'VITE_SOROBAN_RPC_URL') ?? defaults.sorobanRpcUrl;
  const networkPassphrase =
    readEnv(env, 'VITE_STELLAR_NETWORK_PASSPHRASE') ?? defaults.networkPassphrase;
  const creditContractId = readEnv(env, 'VITE_CREDIT_CONTRACT_ID') ?? '';

  validateUrl('VITE_HORIZON_URL', horizonUrl, problems, env);
  validateUrl('VITE_SOROBAN_RPC_URL', sorobanRpcUrl, problems, env);

  const expectedPassphrase = DEFAULTS[effectiveNetwork].networkPassphrase;
  if (networkPassphrase !== expectedPassphrase) {
    problems.push(
      `VITE_STELLAR_NETWORK_PASSPHRASE does not match the ${effectiveNetwork} network. Expected "${expectedPassphrase}" but received "${networkPassphrase}".`
    );
  }

  // Contract id policy: optional for the mock data source, required for the
  // Soroban adapter (which raises its own ConfigError). Only validate the shape
  // when a value is supplied.
  if (creditContractId !== '') {
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
    creditContractId,
    explorerBaseUrl: defaults.explorerBaseUrl,
    friendbotUrl: defaults.friendbotUrl,
  };

  return cached;
}

export function resetCreditNetworkConfigForTests(): void {
  cached = undefined;
}
