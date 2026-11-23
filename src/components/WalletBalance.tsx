import { useEffect, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { usePageVisible } from '../hooks/usePageVisible';
import type { HorizonStreamStatus } from '../services/horizonStream';
import './WalletBalance.css';

const STREAM_STATUS_LABELS: Record<HorizonStreamStatus, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  polling: 'Polling',
};

export function WalletBalance() {
  const { wallet, status, balances, refreshBalance, streamStatus = 'live' } = useWallet();
  const isVisible = usePageVisible();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      wasHiddenRef.current = true;
      return;
    }

    if (status !== 'connected' || !wallet) return;

    if (wasHiddenRef.current) {
      wasHiddenRef.current = false;
      refreshBalance();
      return;
    }

    // Initial fetch if no balances yet; subsequent updates arrive via Horizon SSE stream.
    if (!balances) {
      refreshBalance();
    }
  }, [status, wallet, refreshBalance, balances, isVisible]);

  if (status !== 'connected' || !balances) return null;

  const xlmBalance = balances.find((b) => b.asset === 'XLM');
  const displayBalance = xlmBalance ? `${xlmBalance.balance} XLM` : '0 XLM';
  const statusLabel = STREAM_STATUS_LABELS[streamStatus];

  return (
    <div className="wallet-balance" aria-label="Wallet Balance">
      <span className="wallet-balance-amount">{displayBalance}</span>
      <span
        className={`wallet-balance-indicator wallet-balance-indicator--${streamStatus}`}
        role="status"
        aria-label={`Balance stream: ${statusLabel}`}
        title={statusLabel}
      />
    </div>
  );
}
