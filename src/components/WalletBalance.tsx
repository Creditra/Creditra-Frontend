import { useEffect, useRef, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import './WalletBalance.css';

export function WalletBalance() {
  const { wallet, status, balances, refreshBalance } = useWallet();
  const [isPolling, setIsPolling] = useState(false);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'connected' || !wallet) return;

    // Initial fetch if no balances yet
    if (!balances) {
      refreshBalance();
    }

    const interval = setInterval(async () => {
      setIsPolling(true);
      await refreshBalance();
      // Keep the indicator visible for a moment so the user sees it happened
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = setTimeout(() => {
        setIsPolling(false);
        pollingTimeoutRef.current = null;
      }, 1000);
    }, 15000); // 15s polling

    return () => {
      clearInterval(interval);
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [status, wallet, refreshBalance, balances]);

  if (status !== 'connected' || !balances) return null;

  const xlmBalance = balances.find((b) => b.asset === 'XLM');
  const displayBalance = xlmBalance ? `${xlmBalance.balance} XLM` : '0 XLM';

  return (
    <div className="wallet-balance" aria-label="Wallet Balance">
      <span className="wallet-balance-amount">{displayBalance}</span>
      <span 
        className={`wallet-balance-indicator ${isPolling ? 'polling' : ''}`}
        aria-hidden="true"
        title="Polling balance"
      />
    </div>
  );
}
