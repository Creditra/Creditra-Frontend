import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';

export const useLedgerTime = () => {
  const { wallet } = useWallet();
  const [offset, setOffset] = useState<number>(0);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const syncWithLedger = async () => {
      try {
        const networkUrl = wallet?.network === 'testnet' 
          ? 'https://horizon-testnet.stellar.org' 
          : 'https://horizon.stellar.org';

        const response = await fetch(networkUrl);
        if (!response.ok) throw new Error('Horizon fetch failed');
        
        const data = await response.json();
        const ledgerTime = new Date(data.history_latest_ledger_closed_at).getTime();
        
        if (mounted) {
          setOffset(ledgerTime - Date.now());
          setIsSynced(true);
        }
      } catch (err) {
        console.warn('Failed to sync ledger time, falling back to local clock.');
      }

      if (mounted) {
        timeoutId = setTimeout(syncWithLedger, 30000);
      }
    };

    syncWithLedger();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [wallet?.network]);

  useEffect(() => {
    // Instantly apply the offset the moment it changes
    setNow(Date.now() + offset); 
    
    const ticker = setInterval(() => {
      setNow(Date.now() + offset);
    }, 1000);
    return () => clearInterval(ticker);
  }, [offset]);

  return { now, isSynced };
};
