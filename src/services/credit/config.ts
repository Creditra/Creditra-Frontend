export interface SorobanCreditConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_PASSPHRASE = 'Test SDF Network ; September 2015';
const DEFAULT_CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

export function getSorobanConfig(): SorobanCreditConfig {
  const rpcUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOROBAN_RPC_URL) ||
    DEFAULT_RPC_URL;
  const networkPassphrase =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_NETWORK_PASSPHRASE) ||
    DEFAULT_PASSPHRASE;
  const contractId =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CREDIT_CONTRACT_ID) ||
    DEFAULT_CONTRACT_ID;

  return {
    rpcUrl,
    networkPassphrase,
    contractId,
  };
}

export function getCreditDataSourceType(): 'mock' | 'soroban' {
  const configuredType =
    typeof import.meta !== 'undefined'
      ? import.meta.env?.VITE_CREDIT_DATA_SOURCE
      : undefined;
  const type = configuredType?.trim().toLowerCase();

  if (!type) {
    return 'mock';
  }

  if (type === 'mock' || type === 'soroban') {
    return type;
  }

  throw new Error(
    `Invalid VITE_CREDIT_DATA_SOURCE value "${configuredType}". Allowed values are "mock" and "soroban".`,
  );
}
