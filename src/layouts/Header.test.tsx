import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';
import { WalletProvider } from '../context/WalletContext';
import { KycProvider } from '../context/KycContext';
import { NotificationProvider } from '../context/NotificationContext';
import * as useOnlineHook from '../hooks/useOnline';

vi.mock('../hooks/useOnline');

describe('Header', () => {
  const settingsTriggerRef = { current: null };
  const kycTriggerRef = { current: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useOnlineHook, 'useOnline').mockReturnValue({
      isOnline: true,
      queueAction: vi.fn(),
      checkOnlineStatus: vi.fn(),
      queuedActionCount: 0,
    });
  });

  it('renders network status indicator in the banner', () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <WalletProvider>
            <KycProvider>
              <Header
                settingsTriggerRef={settingsTriggerRef}
                kycTriggerRef={kycTriggerRef}
                onSettingsClick={vi.fn()}
                onKycClick={vi.fn()}
              />
            </KycProvider>
          </WalletProvider>
        </NotificationProvider>
      </MemoryRouter>,
    );

    const header = screen.getByRole('banner');
    expect(
      within(header).getByLabelText('Network status: online'),
    ).toBeInTheDocument();
  });
});
