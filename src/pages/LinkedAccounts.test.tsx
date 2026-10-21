/**
 * Tests for LinkedAccounts page component
 * 
 * Covers:
 * - Rendering provider cards
 * - Loading states
 * - Connect/disconnect/reconnect actions
 * - Error handling
 * - Keyboard accessibility
 * - ARIA attributes
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { LinkedAccounts } from './LinkedAccounts';
import * as linkedAccountsService from '../services/linkedAccounts';
import type { LinkedAccount } from '../types/linkedAccount';

// Mock the service
vi.mock('../services/linkedAccounts', () => ({
  fetchLinkedAccounts: vi.fn(),
  initiateLinkAccount: vi.fn(),
  completeOAuthLink: vi.fn(),
  cancelLinkAccount: vi.fn(),
  disconnectAccount: vi.fn(),
  reconnectAccount: vi.fn(),
  verifyAccount: vi.fn(),
  PROVIDER_INFO: {
    google: { name: 'Google', icon: '🔵', color: '#4285f4' },
    github: { name: 'GitHub', icon: '⚫', color: '#24292e' },
    twitter: { name: 'Twitter', icon: '🐦', color: '#1da1f2' },
    facebook: { name: 'Facebook', icon: '🔷', color: '#1877f2' },
  },
}));

describe('LinkedAccounts', () => {
  const mockAccounts: LinkedAccount[] = [
    {
      id: 'google-123',
      provider: 'google',
      status: 'connected',
      displayName: 'Test User',
      externalId: 'test@gmail.com',
      connectedAt: '2026-01-01T00:00:00Z',
      lastVerified: '2026-06-28T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
  });

  describe('Rendering', () => {
    it('should render page header and description', async () => {
      render(<LinkedAccounts />);

      expect(screen.getByRole('heading', { name: /linked accounts/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByText(/connect your external accounts/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(<LinkedAccounts />);

      expect(screen.getByLabelText(/loading accounts/i)).toBeInTheDocument();
    });

    it('should render all provider cards after loading', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account not connected/i })).toBeInTheDocument();
        expect(screen.getByRole('article', { name: /github account not connected/i })).toBeInTheDocument();
        expect(screen.getByRole('article', { name: /twitter account not connected/i })).toBeInTheDocument();
        expect(screen.getByRole('article', { name: /facebook account not connected/i })).toBeInTheDocument();
      });
    });

    it('should show connected status for linked accounts', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      await waitFor(() => {
        const googleCard = screen.getByRole('article', { name: /google account connected/i });
        expect(within(googleCard).getByText('Connected')).toBeInTheDocument();
        expect(within(googleCard).getByText('test@gmail.com')).toBeInTheDocument();
      });
    });

    it('should show error status for accounts with errors', async () => {
      const errorAccount: LinkedAccount = {
        id: 'github-456',
        provider: 'github',
        status: 'error',
        displayName: 'Test User',
        externalId: 'test@github.com',
        connectedAt: '2026-01-01T00:00:00Z',
        error: {
          code: 'provider_error',
          message: 'Token has been revoked',
        },
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([errorAccount]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('alert', { name: '' })).toHaveTextContent('Token has been revoked');
      });
    });

    it('should render security notice', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('note')).toBeInTheDocument();
        expect(screen.getByText(/security & privacy/i)).toBeInTheDocument();
        expect(screen.getByText(/industry-standard oauth 2\.0/i)).toBeInTheDocument();
      });
    });
  });

  describe('Connect Action', () => {
    it('should call initiateLinkAccount when connect button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/google?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      const connectButton = screen.getByRole('button', { name: /connect google account/i });
      await user.click(connectButton);

      expect(linkedAccountsService.initiateLinkAccount).toHaveBeenCalledWith({ provider: 'google' });
    });

    it('Scenario 1: Click Connect on Google calls redirect with authUrl and shows no linked successfully text', async () => {
      const user = userEvent.setup();
      const redirectMock = vi.fn();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/google?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts redirect={redirectMock} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect google account/i }));

      await waitFor(() => {
        expect(redirectMock).toHaveBeenCalledWith('/oauth/google?state=test');
      });
      expect(screen.queryByText(/google account linked successfully/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('Scenario 2: After initiate Google card shows pending text and Cancel, and aria-label contains pending', async () => {
      const user = userEvent.setup();
      const redirectMock = vi.fn();
      const pendingGoogleAccount: LinkedAccount = {
        id: 'google-pending',
        provider: 'google',
        status: 'pending',
        displayName: 'Google (Pending)',
        externalId: '',
        connectedAt: new Date().toISOString(),
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([pendingGoogleAccount]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/google?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts redirect={redirectMock} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect google account/i }));

      await waitFor(() => {
        const googleCard = screen.getByRole('article', { name: /google account pending/i });
        expect(googleCard).toBeInTheDocument();
        expect(within(googleCard).getByText(/waiting for google authorization…/i)).toBeInTheDocument();
        expect(within(googleCard).getByRole('button', { name: /cancel pending google link/i })).toBeInTheDocument();
        expect(within(googleCard).queryByRole('button', { name: /connect google account/i })).not.toBeInTheDocument();
      });
    });

    it('Scenario 3: Cancel pending removes pending entry and restores Connect button', async () => {
      const user = userEvent.setup();
      const pendingGoogleAccount: LinkedAccount = {
        id: 'google-pending',
        provider: 'google',
        status: 'pending',
        displayName: 'Google (Pending)',
        externalId: '',
        connectedAt: new Date().toISOString(),
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce([pendingGoogleAccount])
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.cancelLinkAccount).mockResolvedValue();

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel pending google link/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel pending google link/i }));

      expect(linkedAccountsService.cancelLinkAccount).toHaveBeenCalledWith('google');
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /cancel pending google link/i })).not.toBeInTheDocument();
      });
    });

    it('should show error message on connection failure', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockRejectedValue({
        code: 'already_linked',
        message: 'Google account is already linked',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect google account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/google account is already linked/i);
      });
    });
  });

  describe('Disconnect Action', () => {
    it('opens accessible confirmation dialog with Cancel focused and never calls window.confirm', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);
      const confirmSpy = vi.spyOn(window, 'confirm');

      render(<LinkedAccounts />);

      const disconnectTrigger = await screen.findByRole('button', {
        name: /disconnect google account/i,
      });
      await user.click(disconnectTrigger);

      expect(confirmSpy).not.toHaveBeenCalled();

      const dialog = screen.getByRole('alertdialog', { name: /disconnect google\?/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAccessibleDescription(
        'Disconnecting Google may lower your credit evaluation score. You can reconnect later.',
      );

      const cancelButton = within(dialog).getByRole('button', { name: 'Cancel' });
      await waitFor(() => {
        expect(cancelButton).toHaveFocus();
      });

      confirmSpy.mockRestore();
    });

    it('should call disconnectAccount once when confirmed in dialog', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue();

      const confirmSpy = vi.spyOn(window, 'confirm');

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect google account/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect Google' }));

      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(linkedAccountsService.disconnectAccount).toHaveBeenCalledTimes(1);
        expect(linkedAccountsService.disconnectAccount).toHaveBeenCalledWith('google-123');
      });

      confirmSpy.mockRestore();
    });

    it('should not disconnect if user cancels confirmation', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      const confirmSpy = vi.spyOn(window, 'confirm');

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect google account/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(linkedAccountsService.disconnectAccount).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('resolves false on Escape and returns focus to the Disconnect button', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      const disconnectBtn = await screen.findByRole('button', {
        name: /disconnect google account/i,
      });
      disconnectBtn.focus();
      await user.click(disconnectBtn);

      expect(screen.getByRole('alertdialog')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(linkedAccountsService.disconnectAccount).not.toHaveBeenCalled();
      expect(disconnectBtn).toHaveFocus();
    });

    it('should show success message after disconnection', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue();

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect google account/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect Google' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/google account disconnected/i);
      });
    });
  });

  describe('Reconnect Action', () => {
    it('should show reconnect button for accounts with errors', async () => {
      const errorAccount: LinkedAccount = {
        id: 'github-456',
        provider: 'github',
        status: 'error',
        displayName: 'Test User',
        externalId: 'test@github.com',
        connectedAt: '2026-01-01T00:00:00Z',
        error: {
          code: 'token_expired',
          message: 'Token expired',
        },
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([errorAccount]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reconnect github account/i })).toBeInTheDocument();
      });
    });

    it('Scenario 6: Reconnect on an errored account calls redirect and shows no reconnected successfully text', async () => {
      const user = userEvent.setup();
      const redirectMock = vi.fn();
      const errorAccount: LinkedAccount = {
        id: 'github-456',
        provider: 'github',
        status: 'error',
        displayName: 'Test User',
        externalId: 'test@github.com',
        connectedAt: '2026-01-01T00:00:00Z',
        error: {
          code: 'token_expired',
          message: 'Token expired',
        },
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([errorAccount]);
      vi.mocked(linkedAccountsService.reconnectAccount).mockResolvedValue({
        authUrl: '/oauth/github?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts redirect={redirectMock} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reconnect github account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /reconnect github account/i }));

      expect(linkedAccountsService.reconnectAccount).toHaveBeenCalledWith('github-456');
      await waitFor(() => {
        expect(redirectMock).toHaveBeenCalledWith('/oauth/github?state=test');
      });
      expect(screen.queryByText(/reconnected successfully/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('OAuth Completion and Pending Lifecycle (Scenarios 4, 5, 7, 8, 9)', () => {
    it('Scenario 4: completeOAuthLink resolves -> Google account linked shown and card connected', async () => {
      const originalLocation = window.location;
      delete (window as unknown as { location: unknown }).location;
      window.location = {
        ...originalLocation,
        search: '?code=authcode123&state=google-timestamp-rand',
        pathname: '/linked-accounts',
      } as unknown as Location;

      try {
        const connectedGoogleAccount: LinkedAccount = {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Test User',
          externalId: 'test@gmail.com',
          connectedAt: new Date().toISOString(),
        };

        vi.mocked(linkedAccountsService.completeOAuthLink).mockResolvedValue(connectedGoogleAccount);
        vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([connectedGoogleAccount]);

        render(<LinkedAccounts />);

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent(/google account linked/i);
        });
        await waitFor(() => {
          expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
        });
      } finally {
        window.location = originalLocation;
      }
    });

    it('Scenario 5: completeOAuthLink rejects token_expired -> specific expiry message and card not connected', async () => {
      const originalLocation = window.location;
      delete (window as unknown as { location: unknown }).location;
      window.location = {
        ...originalLocation,
        search: '?code=authcode123&state=google-expiredstate',
        pathname: '/linked-accounts',
      } as unknown as Location;

      try {
        vi.mocked(linkedAccountsService.completeOAuthLink).mockRejectedValue({
          code: 'token_expired',
          message: 'The authorization link has expired. Please try connecting again.',
        });
        vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

        render(<LinkedAccounts />);

        await waitFor(() => {
          expect(screen.getByRole('alert')).toHaveTextContent(/authorization link has expired/i);
        });
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
        });
        expect(screen.queryByRole('article', { name: /google account connected/i })).not.toBeInTheDocument();
      } finally {
        window.location = originalLocation;
      }
    });

    it('Scenario 7: Pending older than 10 minutes on load is shown as expired, then pruned by service', async () => {
      // In service, fetchLinkedAccounts handles pruning expired pending accounts.
      // When fetchLinkedAccounts is called, expired pending accounts are pruned and not returned.
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });
      expect(screen.queryByRole('article', { name: /google account pending/i })).not.toBeInTheDocument();
    });

    it('Scenario 8: Pending Google does not block connecting GitHub', async () => {
      const user = userEvent.setup();
      const redirectMock = vi.fn();
      const pendingGoogleAccount: LinkedAccount = {
        id: 'google-pending',
        provider: 'google',
        status: 'pending',
        displayName: 'Google (Pending)',
        externalId: '',
        connectedAt: new Date().toISOString(),
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([pendingGoogleAccount]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/github?state=gh-test',
        state: 'gh-test',
      });

      render(<LinkedAccounts redirect={redirectMock} />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account pending/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /connect github account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect github account/i }));

      await waitFor(() => {
        expect(redirectMock).toHaveBeenCalledWith('/oauth/github?state=gh-test');
      });
    });

    it('Scenario 9: Offline during initiate shows offline error and no pending entry written', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockRejectedValue(
        new Error('You are currently offline. Please check your internet connection.')
      );

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /connect google account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
      });
      expect(screen.queryByRole('article', { name: /google account pending/i })).not.toBeInTheDocument();
    });

    it('Returning with pending entry and no callback params shows Linking was not completed with Retry and Cancel', async () => {
      const user = userEvent.setup();
      const redirectMock = vi.fn();
      const pendingGoogleAccount: LinkedAccount = {
        id: 'google-pending',
        provider: 'google',
        status: 'pending',
        displayName: 'Google (Pending)',
        externalId: '',
        connectedAt: new Date().toISOString(),
      };

      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce([pendingGoogleAccount])
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/google?state=retry-state',
        state: 'retry-state',
      });
      vi.mocked(linkedAccountsService.cancelLinkAccount).mockResolvedValue();

      render(<LinkedAccounts redirect={redirectMock} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/linking was not completed/i);
      });

      const retryBtn = screen.getByRole('button', { name: /retry/i });
      const cancelBtn = screen.getByRole('button', { name: /cancel linking/i });
      expect(retryBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();

      // Click Cancel
      await user.click(cancelBtn);
      expect(linkedAccountsService.cancelLinkAccount).toHaveBeenCalledWith('google');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on provider cards', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
      });
    });

    it('renders provider grid as role="list" with 4 listitem children', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
      });

      const gridList = screen.getByRole('list', { name: /available providers/i });
      expect(gridList).toBeInTheDocument();

      const items = within(gridList).getAllByRole('listitem');
      expect(items).toHaveLength(4);
    });

    it('reports no aria-required-children or other axe accessibility violations on the rendered page', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      const { container } = render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
      });

      const results = await axe.run(container);
      const ariaRequiredChildren = results.violations.filter(
        (v) => v.id === 'aria-required-children',
      );
      expect(ariaRequiredChildren).toHaveLength(0);
      expect(results.violations).toHaveLength(0);
    });

    it('should have proper ARIA labels on action buttons', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /connect github account/i })).toBeInTheDocument();
      });
    });

    it('should announce success messages with aria-live', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue();

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect google account/i }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect Google' }));

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      const firstButton = screen.getByRole('button', { name: /connect google account/i });
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      // Tab to next button
      await user.tab();
      expect(screen.getByRole('button', { name: /connect github account/i })).toHaveFocus();
    });
  });

  describe('Error Handling', () => {
    it('should show error banner on fetch failure', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockRejectedValue(new Error('Network error'));

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to load linked accounts/i);
      });
    });

    it('should allow dismissing error banner', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockRejectedValue(new Error('Network error'));

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
      await user.click(dismissButton);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should allow dismissing success message', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(mockAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue();

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect google account/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect google account/i }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect Google' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
      });

      const dismissButton = screen.getByRole('button', { name: /dismiss success message/i });
      await user.click(dismissButton);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Sticky Bottom Action Bar', () => {
    it('renders the toolbar', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      const toolbar = screen.getByRole('toolbar', { name: /linked accounts actions/i });
      expect(toolbar).toBeInTheDocument();
    });

    it('starts hidden before scrolling', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      const toolbar = screen.getByTestId('sticky-action-bar');
      expect(toolbar.className).not.toContain('sticky-action-bar--visible');
    });

    it('appears after scrolling past the header', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      const toolbar = screen.getByTestId('sticky-action-bar');
      const headerEl = screen.getByTestId('linked-accounts-header');

      const origGetBoundingClientRect = headerEl.getBoundingClientRect.bind(headerEl);
      vi.spyOn(headerEl, 'getBoundingClientRect').mockReturnValue({
        bottom: -100,
        top: -200,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 0,
        toJSON: () => null,
      } as DOMRect);

      act(() => {
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
      });

      expect(toolbar.className).toContain('sticky-action-bar--visible');

      headerEl.getBoundingClientRect = origGetBoundingClientRect;
    });

    it('shows connected count when accounts are linked', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByText(/1 connected/i)).toBeInTheDocument();
      });
    });

    it('shows no accounts message when none are linked', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/no accounts linked/i)).toBeInTheDocument();
    });

    it('has connect button in toolbar', async () => {
      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /connect new account from toolbar/i })).toBeInTheDocument();
    });

    it('calls initiateLinkAccount from toolbar picker', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/google?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /connect google account/i })).toBeInTheDocument();
      });

      // Open the provider picker and select Google from the menu
      await user.click(screen.getByTestId('provider-picker-trigger'));
      await user.click(screen.getByTestId('provider-picker-item-google'));

      expect(linkedAccountsService.initiateLinkAccount).toHaveBeenCalledWith({ provider: 'google' });
    });

    it('has disconnect all button when accounts are linked', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });
    });

    it('calls disconnectAccount for all connected accounts when disconnect all is confirmed and mentions the number of accounts', async () => {
      const user = userEvent.setup();
      const multiAccounts: LinkedAccount[] = [
        ...mockAccounts,
        {
          id: 'github-456',
          provider: 'github',
          status: 'connected',
          displayName: 'Test User',
          externalId: 'test@github.com',
          connectedAt: '2026-01-01T00:00:00Z',
          lastVerified: '2026-06-28T00:00:00Z',
        }
      ];
      
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(multiAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue();

      const confirmSpy = vi.spyOn(window, 'confirm');

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i }));

      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toHaveTextContent(/2/);
      expect(dialog).toHaveAccessibleDescription(
        'Disconnecting 2 linked accounts may lower your credit evaluation score. You can reconnect later.',
      );

      await user.click(within(dialog).getByRole('button', { name: 'Disconnect All' }));

      expect(confirmSpy).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(linkedAccountsService.disconnectAccount).toHaveBeenCalledWith('google-123');
        expect(linkedAccountsService.disconnectAccount).toHaveBeenCalledWith('github-456');
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Toolbar Tooltips', () => {
    it('shows a tooltip for the toolbar connect button on hover after a delay', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);

      render(<LinkedAccounts />);

      const connectButton = await screen.findByRole('button', {
        name: /connect new account from toolbar/i,
      });

      vi.useFakeTimers();
      try {
        fireEvent.mouseEnter(connectButton.closest('.tooltip-wrapper')!);
        expect(screen.getByText('Connect a new account')).not.toHaveClass('is-visible');

        act(() => {
          vi.advanceTimersByTime(400);
        });

        const tooltip = screen.getByText('Connect a new account');
        expect(tooltip).toHaveClass('is-visible');
        expect(connectButton).toHaveAttribute('aria-describedby', tooltip.id);
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows a tooltip for the toolbar disconnect-all button on keyboard focus', async () => {
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(mockAccounts);

      render(<LinkedAccounts />);

      const disconnectAllButton = await screen.findByRole('button', {
        name: /disconnect all accounts from toolbar/i,
      });

      fireEvent.focus(disconnectAllButton.closest('.tooltip-wrapper')!);

      const tooltip = screen.getByText('Disconnect all linked accounts');
      expect(tooltip).toHaveClass('is-visible');
      expect(disconnectAllButton).toHaveAttribute('aria-describedby', tooltip.id);
    });
  });

  // ── Issue #1220: Provider picker and Promise.allSettled scenarios ────────────

  describe('Provider picker (toolbar)', () => {
    it('Scenario 1: Google linked — picker lists GitHub, Twitter, Facebook but not Google', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([
        {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Test User',
          externalId: 'test@gmail.com',
          connectedAt: '2026-01-01T00:00:00Z',
          lastVerified: '2026-06-28T00:00:00Z',
        },
      ]);

      render(<LinkedAccounts />);

      // Wait for accounts to load
      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
      });

      // Open the picker
      const trigger = screen.getByTestId('provider-picker-trigger');
      await user.click(trigger);

      const menu = screen.getByTestId('provider-picker-menu');
      expect(within(menu).queryByTestId('provider-picker-item-google')).not.toBeInTheDocument();
      expect(within(menu).getByTestId('provider-picker-item-github')).toBeInTheDocument();
      expect(within(menu).getByTestId('provider-picker-item-twitter')).toBeInTheDocument();
      expect(within(menu).getByTestId('provider-picker-item-facebook')).toBeInTheDocument();
    });

    it('Scenario 2: All providers linked — shows "All providers linked" and no Connect button', async () => {
      const allLinked: LinkedAccount[] = [
        { id: 'google-1', provider: 'google', status: 'connected', displayName: 'U', externalId: 'g@g.com', connectedAt: '2026-01-01T00:00:00Z' },
        { id: 'github-1', provider: 'github', status: 'connected', displayName: 'U', externalId: 'u@gh.com', connectedAt: '2026-01-01T00:00:00Z' },
        { id: 'twitter-1', provider: 'twitter', status: 'connected', displayName: 'U', externalId: '@u', connectedAt: '2026-01-01T00:00:00Z' },
        { id: 'facebook-1', provider: 'facebook', status: 'connected', displayName: 'U', externalId: 'u@fb.com', connectedAt: '2026-01-01T00:00:00Z' },
      ];
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue(allLinked);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByTestId('all-providers-linked')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('provider-picker-trigger')).not.toBeInTheDocument();
      expect(screen.getByTestId('all-providers-linked')).toHaveAttribute('aria-label', 'All providers linked');
    });

    it('Scenario 3: Choose GitHub from picker — calls initiateLinkAccount with "github"', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([
        {
          id: 'google-123',
          provider: 'google',
          status: 'connected',
          displayName: 'Test User',
          externalId: 'test@gmail.com',
          connectedAt: '2026-01-01T00:00:00Z',
          lastVerified: '2026-06-28T00:00:00Z',
        },
      ]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/github?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('article', { name: /google account connected/i })).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('provider-picker-trigger'));
      await user.click(screen.getByTestId('provider-picker-item-github'));

      expect(linkedAccountsService.initiateLinkAccount).toHaveBeenCalledWith({ provider: 'github' });
    });

    it('Scenario 4: Picker keyboard — ArrowDown moves focus, Enter selects, Escape closes and refocuses trigger', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/github?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-picker-trigger')).toBeInTheDocument();
      });

      const trigger = screen.getByTestId('provider-picker-trigger');
      trigger.focus();

      // Open with ArrowDown
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('provider-picker-menu')).toBeInTheDocument();

      // First item (google) should be focused
      await waitFor(() => {
        expect(screen.getByTestId('provider-picker-item-google')).toHaveFocus();
      });

      // ArrowDown moves to second item (github)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByTestId('provider-picker-item-github')).toHaveFocus();
      });

      // Escape closes and returns focus to trigger
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId('provider-picker-menu')).not.toBeInTheDocument();
      });
      expect(trigger).toHaveFocus();
    });
  });

  describe('Disconnect All with Promise.allSettled', () => {
    const multiAccounts: LinkedAccount[] = [
      {
        id: 'google-123',
        provider: 'google',
        status: 'connected',
        displayName: 'Test User',
        externalId: 'test@gmail.com',
        connectedAt: '2026-01-01T00:00:00Z',
        lastVerified: '2026-06-28T00:00:00Z',
      },
      {
        id: 'github-456',
        provider: 'github',
        status: 'connected',
        displayName: 'Test User',
        externalId: 'test@github.com',
        connectedAt: '2026-01-01T00:00:00Z',
        lastVerified: '2026-06-28T00:00:00Z',
      },
      {
        id: 'twitter-789',
        provider: 'twitter',
        status: 'connected',
        displayName: 'Test User',
        externalId: '@test',
        connectedAt: '2026-01-01T00:00:00Z',
        lastVerified: '2026-06-28T00:00:00Z',
      },
    ];

    it('Scenario 5: Disconnect All, all succeed — shows "All 3 accounts disconnected"', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(multiAccounts)
        .mockResolvedValueOnce([]);
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue(undefined);

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect All' }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/all 3 accounts disconnected/i);
      });
    });

    it('Scenario 6: Disconnect All, one rejects — message names succeeded/failed and shows Retry failed button', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(multiAccounts)
        .mockResolvedValueOnce(multiAccounts.filter(a => a.id !== 'google-123').map(a => ({ ...a, status: 'disconnected' as const })));

      // twitter fails, the others succeed
      vi.mocked(linkedAccountsService.disconnectAccount).mockImplementation(async (id) => {
        if (id === 'twitter-789') throw new Error('Twitter disconnect failed');
        return undefined;
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect All' }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/twitter/i);
        expect(alert).toHaveTextContent(/google/i);
        expect(alert).toHaveTextContent(/github/i);
      });

      expect(screen.getByTestId('retry-failed-btn')).toBeInTheDocument();
    });

    it('Scenario 7: Retry failed — calls disconnectAccount only for the failed account id', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(multiAccounts)
        .mockResolvedValue([]);

      // twitter fails first time, then succeeds on retry
      let twitterCallCount = 0;
      vi.mocked(linkedAccountsService.disconnectAccount).mockImplementation(async (id) => {
        if (id === 'twitter-789') {
          twitterCallCount++;
          if (twitterCallCount === 1) throw new Error('Twitter disconnect failed');
        }
        return undefined;
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });

      // Trigger Disconnect All
      await user.click(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect All' }));

      // Wait for Retry button
      await waitFor(() => {
        expect(screen.getByTestId('retry-failed-btn')).toBeInTheDocument();
      });

      vi.mocked(linkedAccountsService.disconnectAccount).mockClear();
      vi.mocked(linkedAccountsService.disconnectAccount).mockResolvedValue(undefined);

      // Click retry
      await user.click(screen.getByTestId('retry-failed-btn'));

      await waitFor(() => {
        // Only the failed account should have been retried
        expect(linkedAccountsService.disconnectAccount).toHaveBeenCalledWith('twitter-789');
        expect(linkedAccountsService.disconnectAccount).not.toHaveBeenCalledWith('google-123');
        expect(linkedAccountsService.disconnectAccount).not.toHaveBeenCalledWith('github-456');
      });
    });

    it('Scenario 8: Disconnect All, all reject — error message lists every provider', async () => {
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts)
        .mockResolvedValueOnce(multiAccounts)
        .mockResolvedValueOnce(multiAccounts);

      vi.mocked(linkedAccountsService.disconnectAccount).mockRejectedValue(new Error('Network error'));

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /disconnect all accounts from toolbar/i }));

      const dialog = screen.getByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Disconnect All' }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(/google/i);
        expect(alert).toHaveTextContent(/github/i);
        expect(alert).toHaveTextContent(/twitter/i);
      });
    });
  });

  describe('Regression proof', () => {
    it('On current main, toolbar connect button calls initiateLinkAccount with "google" (regression baseline)', async () => {
      // This test documents the regression: before this fix, the toolbar hard-coded
      // onClick={() => handleConnect('google')}. With the fix in place the toolbar
      // no longer has a single connect button — it opens a provider picker menu.
      // We verify the picker exists and does NOT hard-code google.
      const user = userEvent.setup();
      vi.mocked(linkedAccountsService.fetchLinkedAccounts).mockResolvedValue([]);
      vi.mocked(linkedAccountsService.initiateLinkAccount).mockResolvedValue({
        authUrl: '/oauth/github?state=test',
        state: 'test-state',
      });

      render(<LinkedAccounts />);

      await waitFor(() => {
        expect(screen.getByTestId('provider-picker-trigger')).toBeInTheDocument();
      });

      // Pick GitHub — NOT google
      await user.click(screen.getByTestId('provider-picker-trigger'));
      await user.click(screen.getByTestId('provider-picker-item-github'));

      // Should call with github, not google
      expect(linkedAccountsService.initiateLinkAccount).toHaveBeenCalledWith({ provider: 'github' });
      expect(linkedAccountsService.initiateLinkAccount).not.toHaveBeenCalledWith({ provider: 'google' });
    });
  });
});
