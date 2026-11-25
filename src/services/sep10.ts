import { StellarToml, WebAuth } from '@stellar/stellar-sdk';
import type { WalletInfo } from '../types/wallet';
import type {
  AuthErrorCode,
  Sep10Challenge,
  Sep10Session,
} from '../types/auth.types';
import { getCreditNetworkConfig } from '../config/creditNetwork';
import { signTransaction, classifyWalletError } from '../utils/wallet';
import { isValidAccountId } from '../utils/strkey';
import { WalletConnectError } from '../types/wallet';

export class Sep10AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'Sep10AuthError';
    Object.setPrototypeOf(this, Sep10AuthError.prototype);
  }
}

interface Sep10Config {
  authUrl: string;
  homeDomain: string;
  network: string;
  networkPassphrase: string;
}

function getSep10Config(): Sep10Config {
  try {
    const config = getCreditNetworkConfig();
    if (!config.sep10AuthUrl || !config.sep10HomeDomain) {
      throw new Sep10AuthError(
        'configuration_error',
        'Wallet sign-in is not configured for this application.',
      );
    }
    return {
      authUrl: config.sep10AuthUrl,
      homeDomain: config.sep10HomeDomain,
      network: config.network,
      networkPassphrase: config.networkPassphrase,
    };
  } catch (error) {
    if (error instanceof Sep10AuthError) throw error;
    throw new Sep10AuthError(
      'configuration_error',
      'The Stellar network configuration is invalid.',
    );
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Sep10AuthError(
      'request_failed',
      'The authentication server returned an invalid response.',
    );
  }
}

function isSep10Challenge(value: unknown): value is Sep10Challenge {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.transaction === 'string' &&
    record.transaction.length > 0 &&
    typeof record.network_passphrase === 'string'
  );
}

/** Request a server-signed SEP-10 challenge for the supplied Stellar account. */
export async function requestChallenge(account: string): Promise<Sep10Challenge> {
  if (!isValidAccountId(account)) {
    throw new Sep10AuthError('invalid_challenge', 'The wallet returned an invalid account.');
  }
  const config = getSep10Config();
  const url = new URL(config.authUrl);
  url.searchParams.set('account', account);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Sep10AuthError(
      'request_failed',
      'Unable to contact the wallet authentication server.',
    );
  }
  if (!response.ok) {
    throw new Sep10AuthError(
      'request_failed',
      'The wallet authentication server could not create a challenge.',
    );
  }

  const body = await readJsonResponse(response);
  if (!isSep10Challenge(body)) {
    throw new Sep10AuthError(
      'invalid_challenge',
      'The authentication server returned an invalid challenge.',
    );
  }
  return body;
}

/** Submit the wallet-signed challenge and return the issued session token. */
export async function verifyChallenge(signedXdr: string): Promise<Sep10Session> {
  const config = getSep10Config();
  let response: Response;
  try {
    response = await fetch(config.authUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transaction: signedXdr }),
    });
  } catch {
    throw new Sep10AuthError(
      'request_failed',
      'Unable to contact the wallet authentication server.',
    );
  }
  if (!response.ok) {
    throw new Sep10AuthError(
      'request_failed',
      'The authentication server could not verify the wallet signature.',
    );
  }

  const body = await readJsonResponse(response);
  const token =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).token
      : undefined;
  if (typeof token !== 'string' || token.length === 0) {
    throw new Sep10AuthError(
      'request_failed',
      'The authentication server did not return a session token.',
    );
  }
  return { token };
}

async function getServerSigningKey(homeDomain: string): Promise<string> {
  let stellarToml: Awaited<ReturnType<typeof StellarToml.Resolver.resolve>>;
  try {
    stellarToml = await StellarToml.Resolver.resolve(homeDomain);
  } catch {
    throw new Sep10AuthError(
      'configuration_error',
      'Unable to load the SEP-10 server signing key.',
    );
  }
  if (typeof stellarToml.SIGNING_KEY !== 'string') {
    throw new Sep10AuthError(
      'configuration_error',
      'The configured home domain has no SEP-10 server signing key.',
    );
  }
  return stellarToml.SIGNING_KEY;
}

function validateChallenge(
  challenge: Sep10Challenge,
  account: string,
  serverAccount: string,
  config: Sep10Config,
): string {
  if (challenge.network_passphrase !== config.networkPassphrase) {
    throw new Sep10AuthError(
      'invalid_challenge',
      'The challenge is for a different Stellar network.',
    );
  }

  let parsed: ReturnType<typeof WebAuth.readChallengeTx>;
  try {
    parsed = WebAuth.readChallengeTx(
      challenge.transaction,
      serverAccount,
      config.networkPassphrase,
      config.homeDomain,
      new URL(config.authUrl).hostname,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('expired')) {
      throw new Sep10AuthError(
        'challenge_expired',
        'The wallet sign-in challenge has expired. Please try again.',
      );
    }
    throw new Sep10AuthError(
      'invalid_challenge',
      'The authentication server returned an invalid wallet challenge.',
    );
  }

  if (parsed.clientAccountID !== account) {
    throw new Sep10AuthError(
      'invalid_challenge',
      'The challenge is for a different wallet account.',
    );
  }
  if (parsed.tx.sequence !== '0') {
    throw new Sep10AuthError(
      'invalid_challenge',
      'The challenge transaction must have sequence number zero.',
    );
  }

  const bounds = parsed.tx.timeBounds;
  const now = Math.floor(Date.now() / 1000);
  if (
    !bounds ||
    Number(bounds.minTime) > now ||
    Number(bounds.maxTime) <= now
  ) {
    throw new Sep10AuthError(
      'challenge_expired',
      'The wallet sign-in challenge has expired. Please try again.',
    );
  }
  return challenge.transaction;
}

/** Complete SEP-10 challenge, wallet signature, and server verification. */
export async function signInWithWallet(wallet: WalletInfo): Promise<Sep10Session> {
  const config = getSep10Config();
  if (wallet.network.toUpperCase() !== config.network) {
    throw new Sep10AuthError(
      'wrong_network',
      `Switch your wallet to Stellar ${config.network === 'PUBLIC' ? 'Public Network' : 'Testnet'} and try again.`,
    );
  }

  const challenge = await requestChallenge(wallet.publicKey);
  const serverAccount = await getServerSigningKey(config.homeDomain);
  const unsignedXdr = validateChallenge(
    challenge,
    wallet.publicKey,
    serverAccount,
    config,
  );

  let signedXdr: string;
  try {
    signedXdr = await signTransaction(wallet, unsignedXdr, config.networkPassphrase);
  } catch (error) {
    if (
      error instanceof WalletConnectError &&
      error.type === 'user_rejected'
    ) {
      throw new Sep10AuthError(
        'user_rejected',
        'You cancelled the wallet signature. You can try signing in again.',
      );
    }
    const walletError = classifyWalletError(error);
    throw new Sep10AuthError(
      walletError.type === 'wrong_network' ? 'wrong_network' : 'wallet_error',
      walletError.message,
    );
  }

  return verifyChallenge(signedXdr);
}
