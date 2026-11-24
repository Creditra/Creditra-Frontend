import { getCreditNetworkConfig } from '../../config/creditNetwork';

export interface SorobanCreditConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
}

/**
 * Thin adapter over the unified network configuration.
 *
 * `VITE_STELLAR_NETWORK`, `VITE_SOROBAN_RPC_URL`,
 * `VITE_STELLAR_NETWORK_PASSPHRASE` and `VITE_CREDIT_CONTRACT_ID` are read in
 * exactly one place (`src/config/creditNetwork.ts`); this module only reshapes
 * that result for the Soroban data source.
 *
 * `contractId` may be empty when no contract is configured. That is valid for
 * the mock data source; `SorobanCreditDataSource` raises a `ConfigError` when
 * it actually needs a contract.
 */
export function getSorobanConfig(): SorobanCreditConfig {
  const config = getCreditNetworkConfig();

  return {
    rpcUrl: config.sorobanRpcUrl,
    networkPassphrase: config.networkPassphrase,
    contractId: config.creditContractId,
  };
}

export function getCreditDataSourceType(): 'mock' | 'soroban' {
  const type =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_CREDIT_DATA_SOURCE;
  return type === 'soroban' ? 'soroban' : 'mock';
}
