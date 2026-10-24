import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WalletProvider } from '../../context/WalletContext';
import { LinkedAccounts } from '../LinkedAccounts';
import * as linkedAccountsService from '../../services/linkedAccounts';
import type { WalletInfo } from '../../types/wallet';
import type { LinkedAccount } from '../../types/linkedAccount';

const WALLET_A: WalletInfo = {
  publicKey: 'GBRPYHIL2CI3FNQ4AFJMFKOBOMU3FO244DCISFO3ZHSXZSSVU2ZBXA2T',
  type: 'freighter',
  network: 'testnet',
};

const WALLET_B: WalletInfo = {
  publicKey: 'GCKF7HQPO2AFUJG5GNO6MQ2TNPZZQ4H7Z4KTYL3QG3FGLO352YOH5YTR',
  type: 'freighter',
  network: 'testnet',
};

vi.mock('../../services/linkedAccounts', async () => {
  const actual = await vi.importActual<typeof import('../../services/linkedAccounts')>(
    '../../services/linkedAccounts',
  );
  return {
    ...actual,
    fetchLinkedAccounts: vi.fn(),
    initiateLinkAccount: vi.fn(),
    disconnectAccount: vi.fn(),
    reconnectAccount: vi.fn(),
    verifyAccount: vi.fn(),
  };
});

describe('LinkedAccounts wallet scoping', () => {
  const accountA: LinkedAccount = {
    id: 'github-1',
    provider: 'github',
    status: 'connected',
    displayName: 'A User',
    externalId: 'user-a@github.com',
    connectedAt: new Date().toISOString(),
    lastVerified: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('Scenario 3: A links GitHub, switch to B -> B sees no linked accounts', async () => {
    vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockImplementation(async (scope) => {
      if (scope === WALLET_A.publicKey) {
        return [accountA];
      }
      return [];
    });

    const { rerender } = render(
      <WalletProvider initialWallet={WALLET_A}>
        <LinkedAccounts />
      </WalletProvider>,
    );

    // Wallet A sees GitHub connected
    await waitFor(() => {
      expect(screen.getByRole('article', { name: /github account connected/i })).toBeInTheDocument();
    });

    // Switch to Wallet B
    rerender(
      <WalletProvider initialWallet={WALLET_B}>
        <LinkedAccounts />
      </WalletProvider>,
    );

    // B sees no linked accounts (all unlinked)
    await waitFor(() => {
      expect(screen.getByRole('article', { name: /github account not connected/i })).toBeInTheDocument();
    });
  });

  it('Scenario 5: Disconnected state shows "Connect a wallet to manage linked accounts"', async () => {
    render(
      <WalletProvider initialWallet={null}>
        <LinkedAccounts />
      </WalletProvider>,
    );

    expect(screen.getByText('Connect a wallet to manage linked accounts')).toBeInTheDocument();
    expect(linkedAccountsService.fetchLinkedAccounts).not.toHaveBeenCalled();
  });
});
