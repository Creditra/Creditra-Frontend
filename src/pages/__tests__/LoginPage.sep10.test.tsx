import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from '../../context/WalletContext';
import * as sep10 from '../../services/sep10';
import type { WalletInfo } from '../../types/wallet';
import { LoginPage } from '../LoginPage';

vi.mock('../../context/WalletContext', () => ({
  useWallet: vi.fn(),
}));

const wallet: WalletInfo = {
  type: 'freighter',
  publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  network: 'TESTNET',
};

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname + location.search}</output>;
}

function renderLoginPage(path = '/login?redirect=%2Fsettings%2Faccounts') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useWallet).mockReturnValue({ wallet } as ReturnType<typeof useWallet>);
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe('LoginPage SEP-10 wallet sign-in', () => {
  it('stores the returned token in the session and safely redirects', async () => {
    vi.spyOn(sep10, 'signInWithWallet').mockResolvedValue({ token: 'wallet-token' });
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in with wallet/i }));

    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/settings/accounts');
    });
    expect(sessionStorage.getItem('auth_token')).toBe('wallet-token');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('uses persistent storage only when Remember me is selected', async () => {
    vi.spyOn(sep10, 'signInWithWallet').mockResolvedValue({ token: 'wallet-token' });
    renderLoginPage();

    fireEvent.click(screen.getByRole('checkbox', { name: /remember me/i }));
    fireEvent.click(screen.getByRole('button', { name: /sign in with wallet/i }));

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('wallet-token');
    });
    expect(sessionStorage.getItem('auth_token')).toBeNull();
  });

  it('shows a clear message when the user rejects the wallet signature', async () => {
    vi.spyOn(sep10, 'signInWithWallet').mockRejectedValue(
      new sep10.Sep10AuthError(
        'user_rejected',
        'You cancelled the wallet signature. You can try signing in again.',
      ),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /sign in with wallet/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/cancelled the wallet signature/i);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign in with wallet/i }),
      ).toHaveAttribute('aria-busy', 'false');
    });
  });

  it('falls back to the dashboard for an unsafe post-login redirect', async () => {
    vi.spyOn(sep10, 'signInWithWallet').mockResolvedValue({ token: 'wallet-token' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderLoginPage('/login?redirect=https%3A%2F%2Fevil.example');

    fireEvent.click(screen.getByRole('button', { name: /sign in with wallet/i }));

    await waitFor(() => {
      expect(screen.getByTestId('current-path')).toHaveTextContent('/dashboard');
    });
  });
});
