import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WalletProvider } from '../WalletContext';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import { scopedKey } from '../../utils/scoped-storage';
import type { WalletInfo } from '../../types/wallet';

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

function TestConsumer() {
  const {
    notifications,
    addToast,
    preferences,
    updatePreferences,
  } = useNotifications();

  return (
    <div>
      <span data-testid="notification-count">{notifications.length}</span>
      <div data-testid="notification-titles">
        {notifications.map(n => n.title).join(',')}
      </div>
      <span data-testid="pref-system">{preferences.system ? 'on' : 'off'}</span>
      <button
        onClick={() => {
          addToast({
            type: 'info',
            title: `Notification ${notifications.length + 1}`,
            message: 'Test message',
            saveToHistory: true,
          });
        }}
      >
        Add Notification
      </button>
      <button
        onClick={() => {
          updatePreferences({ system: false });
        }}
      >
        Mute System
      </button>
    </div>
  );
}

function TestRoot({ currentWallet }: { currentWallet: WalletInfo | null }) {
  return (
    <WalletProvider initialWallet={currentWallet}>
      <NotificationProvider>
        <TestConsumer />
      </NotificationProvider>
    </WalletProvider>
  );
}

describe('NotificationContext wallet scoping', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('Scenario 1 & 2: Wallet A gets 2 notifications, switch to B (empty), switch back to A (2 return)', async () => {
    const { rerender } = render(<TestRoot currentWallet={WALLET_A} />);

    // Add 2 notifications under Wallet A
    const addBtn = screen.getByText('Add Notification');
    act(() => {
      addBtn.click();
    });
    act(() => {
      addBtn.click();
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('2');
    expect(screen.getByTestId('notification-titles').textContent).toBe(
      'Notification 2,Notification 1',
    );

    // Verify written under A's scoped key
    const keyA = scopedKey('creditra_notifications', WALLET_A.publicKey);
    expect(localStorage.getItem(keyA)).not.toBeNull();

    // Scenario 1: Switch to Wallet B -> B's inbox is empty
    rerender(<TestRoot currentWallet={WALLET_B} />);

    expect(screen.getByTestId('notification-count').textContent).toBe('0');
    expect(screen.getByTestId('notification-titles').textContent).toBe('');

    // Scenario 2: Switch back to Wallet A -> A's 2 notifications return
    rerender(<TestRoot currentWallet={WALLET_A} />);

    expect(screen.getByTestId('notification-count').textContent).toBe('2');
    expect(screen.getByTestId('notification-titles').textContent).toBe(
      'Notification 2,Notification 1',
    );
  });

  it('Preferences: Category preferences changed under A are isolated from B', async () => {
    const { rerender } = render(<TestRoot currentWallet={WALLET_A} />);

    expect(screen.getByTestId('pref-system').textContent).toBe('on');

    // Mute system under A
    const muteBtn = screen.getByText('Mute System');
    act(() => {
      muteBtn.click();
    });

    expect(screen.getByTestId('pref-system').textContent).toBe('off');

    // Switch to B -> B sees defaults (system: on)
    rerender(<TestRoot currentWallet={WALLET_B} />);

    expect(screen.getByTestId('pref-system').textContent).toBe('on');

    // Switch back to A -> A sees system: off
    rerender(<TestRoot currentWallet={WALLET_A} />);

    expect(screen.getByTestId('pref-system').textContent).toBe('off');
  });

  it('Scenario 5: Disconnected state shows empty inbox and does not write to storage', async () => {
    render(<TestRoot currentWallet={null} />);

    expect(screen.getByTestId('notification-count').textContent).toBe('0');

    // Try adding notification while disconnected
    const addBtn = screen.getByText('Add Notification');
    act(() => {
      addBtn.click();
    });

    expect(screen.getByTestId('notification-count').textContent).toBe('0');

    // Verify storage has nothing written
    expect(localStorage.length).toBe(0);
  });

  it('Scenario 6: Migrates legacy global notifications into A on first connect', async () => {
    const legacyInbox = [
      {
        id: 'legacy-1',
        type: 'info',
        category: 'system',
        title: 'Legacy Notification',
        message: 'From before upgrade',
        timestamp: new Date().toISOString(),
        read: false,
      },
    ];
    localStorage.setItem('creditra_notifications', JSON.stringify(legacyInbox));

    render(<TestRoot currentWallet={WALLET_A} />);

    // Global key was removed
    expect(localStorage.getItem('creditra_notifications')).toBeNull();

    // Data was moved to A's scope
    const keyA = scopedKey('creditra_notifications', WALLET_A.publicKey);
    expect(localStorage.getItem(keyA)).not.toBeNull();

    // Inbox shows the migrated notification
    expect(screen.getByTestId('notification-count').textContent).toBe('1');
    expect(screen.getByTestId('notification-titles').textContent).toBe('Legacy Notification');
  });
});
