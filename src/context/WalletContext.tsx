import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletInfo, ConnectionStatus, WalletError, WalletType } from '../types/wallet';
import { connectWallet, disconnectWallet, saveWalletPreference, getStoredWallet } from '../utils/wallet';

interface WalletContextType {
  wallet: WalletInfo | null;
  status: ConnectionStatus;
  error: WalletError | null;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<WalletError | null>(null);

  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) {
      setWallet(stored);
      setStatus('connected');
    }
  }, []);

  const connect = async (type: WalletType) => {
    setStatus('connecting');
    setError(null);

    try {
      const walletInfo = await connectWallet(type);
      setWallet(walletInfo);
      setStatus('connected');
      saveWalletPreference(walletInfo);
    } catch (err) {
      setError(err as WalletError);
      setStatus('error');
      setWallet(null);
    }
  };

  const disconnect = () => {
    disconnectWallet();
    setWallet(null);
    setStatus('disconnected');
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <WalletContext.Provider value={{ wallet, status, error, connect, disconnect, clearError }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used within WalletProvider');
  return context;
};
