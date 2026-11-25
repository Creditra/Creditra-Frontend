import {
  Account,
  Keypair,
  Operation,
  StellarToml,
  TransactionBuilder,
  WebAuth,
} from '@stellar/stellar-sdk';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WalletInfo } from '../types/wallet';
import { WalletConnectError } from '../types/wallet';
import * as creditNetwork from '../config/creditNetwork';
import * as walletUtils from '../utils/wallet';
import {
  requestChallenge,
  signInWithWallet,
} from './sep10';

const HOME_DOMAIN = 'example.com';
const AUTH_URL = 'https://auth.example.com/sep10';
const AUTH_HOST = 'auth.example.com';
const TESTNET_PASSPHRASE = 'Test Stellar Network ; February 2015';
const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

class TestTextEncoder extends NodeTextEncoder {
  override encode(input = ''): Uint8Array {
    return Uint8Array.from(super.encode(input));
  }
}

describe('SEP-10 wallet sign-in', () => {
  let server: Keypair;
  let otherServer: Keypair;
  let wallet: WalletInfo;
  let signSpy: ReturnType<typeof vi.spyOn>;

  const queueChallenge = (
    transaction: string,
    networkPassphrase = TESTNET_PASSPHRASE,
  ) => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          transaction,
          network_passphrase: networkPassphrase,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  };

  const validChallenge = (timeout = 300) =>
    WebAuth.buildChallengeTx(
      server,
      wallet.publicKey,
      HOME_DOMAIN,
      timeout,
      TESTNET_PASSPHRASE,
      AUTH_HOST,
    );

  const challengeWithBounds = (
    accountSequence: string,
    minTime: number,
    maxTime: number,
  ) => {
    const transaction = new TransactionBuilder(
      new Account(server.publicKey(), accountSequence),
      {
        fee: '100',
        networkPassphrase: TESTNET_PASSPHRASE,
        timebounds: { minTime, maxTime },
      },
    )
      .addOperation(
        Operation.manageData({
          name: `${HOME_DOMAIN} auth`,
          value: 'A'.repeat(64),
          source: wallet.publicKey,
        }),
      )
      .addOperation(
        Operation.manageData({
          name: 'web_auth_domain',
          value: AUTH_HOST,
        }),
      )
      .build();
    transaction.sign(server);
    return transaction.toXDR();
  };

  beforeEach(() => {
    vi.stubGlobal('TextEncoder', TestTextEncoder);
    server = Keypair.random();
    otherServer = Keypair.random();
    wallet = {
      type: 'freighter',
      publicKey: Keypair.random().publicKey(),
      network: 'TESTNET',
    };
    vi.spyOn(creditNetwork, 'getCreditNetworkConfig').mockReturnValue({
      network: 'TESTNET',
      horizonUrl: 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: TESTNET_PASSPHRASE,
      creditContractId: 'C'.repeat(56),
      sep10AuthUrl: AUTH_URL,
      sep10HomeDomain: HOME_DOMAIN,
    });
    vi.spyOn(StellarToml.Resolver, 'resolve').mockResolvedValue({
      SIGNING_KEY: server.publicKey(),
    });
    signSpy = vi.spyOn(walletUtils, 'signTransaction').mockResolvedValue('signed-xdr');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('requests a challenge for the wallet account', async () => {
    const challenge = validChallenge();
    queueChallenge(challenge);

    await expect(requestChallenge(wallet.publicKey)).resolves.toEqual({
      transaction: challenge,
      network_passphrase: TESTNET_PASSPHRASE,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`account=${wallet.publicKey}`),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('signs and verifies a valid challenge', async () => {
    queueChallenge(validChallenge());
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'session-token' }), { status: 200 }),
    );

    await expect(signInWithWallet(wallet)).resolves.toEqual({
      token: 'session-token',
    });
    expect(signSpy).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenLastCalledWith(
      AUTH_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ transaction: 'signed-xdr' }),
      }),
    );
  });

  it('rejects a challenge signed by the wrong server before prompting the wallet', async () => {
    vi.mocked(StellarToml.Resolver.resolve).mockResolvedValue({
      SIGNING_KEY: otherServer.publicKey(),
    });
    queueChallenge(validChallenge());

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects a challenge addressed to a different wallet before prompting', async () => {
    const challenge = WebAuth.buildChallengeTx(
      server,
      Keypair.random().publicKey(),
      HOME_DOMAIN,
      300,
      TESTNET_PASSPHRASE,
      AUTH_HOST,
    );
    queueChallenge(challenge);

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects a challenge for the wrong home domain before prompting', async () => {
    const challenge = WebAuth.buildChallengeTx(
      server,
      wallet.publicKey,
      'other.example',
      300,
      TESTNET_PASSPHRASE,
      AUTH_HOST,
    );
    queueChallenge(challenge);

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects a challenge signed for the wrong network passphrase before prompting', async () => {
    const publicChallenge = WebAuth.buildChallengeTx(
      server,
      wallet.publicKey,
      HOME_DOMAIN,
      300,
      PUBLIC_PASSPHRASE,
      AUTH_HOST,
    );
    queueChallenge(publicChallenge, TESTNET_PASSPHRASE);

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects a challenge response with a mismatched network passphrase', async () => {
    queueChallenge(validChallenge(), PUBLIC_PASSPHRASE);

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects expired challenge bounds before prompting the wallet', async () => {
    const now = Math.floor(Date.now() / 1000);
    queueChallenge(challengeWithBounds('-1', 0, now - 600));

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'challenge_expired',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects non-zero sequence numbers before prompting the wallet', async () => {
    const now = Math.floor(Date.now() / 1000);
    queueChallenge(challengeWithBounds('7', now, now + 300));

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'invalid_challenge',
    });
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('rejects a wallet on the wrong network before requesting a challenge', async () => {
    await expect(
      signInWithWallet({ ...wallet, network: 'PUBLIC' }),
    ).rejects.toMatchObject({ code: 'wrong_network' });
    expect(fetch).not.toHaveBeenCalled();
    expect(signSpy).not.toHaveBeenCalled();
  });

  it('returns a clear error when the user rejects the wallet prompt', async () => {
    queueChallenge(validChallenge());
    signSpy.mockRejectedValue(
      new WalletConnectError('user_rejected', 'Signature request rejected'),
    );

    await expect(signInWithWallet(wallet)).rejects.toMatchObject({
      code: 'user_rejected',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
