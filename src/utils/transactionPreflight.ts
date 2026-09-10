import type { WalletInfo, ConnectionStatus } from '../types/wallet';
import type { PreflightCheckResult, PreflightStatus } from '../types/transactionPreflight';
import { EXPECTED_NETWORK } from './wallet';
import { shortenAddress } from './format-address';

/**
 * Normalizes a network identifier to uppercase standard representation.
 *
 * @param network Raw network string or undefined.
 * @returns Normalized network name.
 */
export function normalizeNetwork(network?: string | null): string {
  if (!network) return '';
  const trimmed = network.trim().toUpperCase();
  if (trimmed === 'MAINNET') return 'PUBLIC';
  return trimmed;
}

/**
 * Validates whether the active network matches the expected network.
 *
 * @param current Currently connected wallet network.
 * @param expected Required network for the transaction.
 * @returns True if networks match.
 */
export function isNetworkMatching(current?: string | null, expected?: string | null): boolean {
  if (!current || !expected) return false;
  return normalizeNetwork(current) === normalizeNetwork(expected);
}

/**
 * Validates whether the connected account matches the expected transaction authority.
 *
 * @param current Currently connected public key.
 * @param expected Expected authority public key.
 * @returns True if accounts match or if no specific expected account is mandated.
 */
export function isAccountMatching(current?: string | null, expected?: string | null): boolean {
  if (!expected || expected.trim() === '') return true;
  if (!current) return false;
  return current.trim() === expected.trim();
}

/**
 * Generates a stable identity string for detecting mid-flow account/network switches.
 *
 * @param wallet Active wallet info.
 * @returns Serialized identity key or null.
 */
export function getPreflightIdentityKey(wallet: WalletInfo | null): string | null {
  if (!wallet || !wallet.publicKey) return null;
  return `${wallet.type}:${wallet.publicKey}:${normalizeNetwork(wallet.network)}`;
}

/**
 * Evaluates transaction preflight conditions against current wallet state.
 *
 * @param params Contextual wallet state, expected network, expected account, and session snapshot.
 * @returns Complete preflight evaluation result.
 */
export function evaluatePreflight(params: {
  wallet: WalletInfo | null;
  status: ConnectionStatus;
  expectedNetwork?: string;
  expectedAccount?: string | null;
  initialIdentityKey?: string | null;
}): PreflightCheckResult {
  const expectedNetwork = normalizeNetwork(params.expectedNetwork || EXPECTED_NETWORK);
  const expectedAccount = params.expectedAccount?.trim() || null;
  const connectedAccount = params.wallet?.publicKey?.trim() || null;
  const connectedNetwork = params.wallet?.network ? normalizeNetwork(params.wallet.network) : null;

  const isConnected = Boolean(params.wallet && params.status === 'connected' && connectedAccount);
  const isNetworkMatch = isConnected && isNetworkMatching(connectedNetwork, expectedNetwork);
  const isAccountMatch = isConnected && isAccountMatching(connectedAccount, expectedAccount);

  const currentIdentityKey = getPreflightIdentityKey(params.wallet);
  const isIdentityFresh = !params.initialIdentityKey || !currentIdentityKey
    ? true
    : params.initialIdentityKey === currentIdentityKey;

  let status: PreflightStatus = 'ready';
  let canSign = true;
  let blockReason: string | null = null;

  if (!isConnected) {
    status = 'disconnected';
    canSign = false;
    blockReason = 'Wallet disconnected. Connect your wallet to sign this transaction.';
  } else if (!isNetworkMatch) {
    status = 'wrong_network';
    canSign = false;
    blockReason = `Wrong network. Connected to ${connectedNetwork || 'unknown'}, expected ${expectedNetwork}.`;
  } else if (!isAccountMatch) {
    status = 'account_mismatch';
    canSign = false;
    blockReason = `Account mismatch. Transaction requires ${shortenAddress(expectedAccount || '')}, but connected account is ${shortenAddress(connectedAccount || '')}.`;
  } else if (!isIdentityFresh) {
    status = 'stale_identity';
    canSign = false;
    blockReason = 'Stale wallet identity. Wallet identity changed during this session. Re-verify transaction details before signing.';
  }

  return {
    status,
    canSign,
    isNetworkMatch,
    isAccountMatch,
    isIdentityFresh,
    connectedAccount,
    connectedNetwork,
    expectedAccount,
    expectedNetwork,
    blockReason,
  };
}
