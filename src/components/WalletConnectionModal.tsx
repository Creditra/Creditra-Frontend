import { useState } from 'react';
import { useWallet } from '../context/WalletContext';
import { WalletType } from '../types/wallet';
import './WalletConnectionModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const wallets = [
  {
    type: 'freighter' as WalletType,
    name: 'Freighter',
    description: 'Browser extension wallet for Stellar',
    iconUrl: 'https://stellar.creit.tech/wallet-icons/freighter.svg'
  },
  {
    type: 'albedo' as WalletType,
    name: 'Albedo',
    description: 'Web-based Stellar wallet',
    iconUrl: 'https://stellar.creit.tech/wallet-icons/albedo.svg'
  },
  {
    type: 'xbull' as WalletType,
    name: 'xBull',
    description: 'Mobile and browser wallet',
    iconUrl: 'https://stellar.creit.tech/wallet-icons/xbull.svg'
  },
  {
    type: 'rabet' as WalletType,
    name: 'Rabet',
    description: 'Browser extension wallet',
    iconUrl: 'https://stellar.creit.tech/wallet-icons/rabet.svg'
  }
];

export const WalletConnectionModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const { status, error, connect, clearError } = useWallet();
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);

  if (!isOpen) return null;

  const handleConnect = async (type: WalletType) => {
    setSelectedWallet(type);
    await connect(type);
    if (status === 'connected') {
      onSuccess?.();
      setTimeout(onClose, 1500);
    }
  };

  const handleClose = () => {
    clearError();
    setSelectedWallet(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Wallet</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        {status === 'connected' ? (
          <div className="success-state">
            <div className="success-icon">✓</div>
            <h3>Wallet Connected!</h3>
            <p>You're all set to start using Creditra</p>
          </div>
        ) : (
          <>
            <p className="modal-description">
              Choose a wallet to connect to Creditra. Your wallet will be used to access credit lines on Stellar.
            </p>

            <div className="wallet-list">
              {wallets.map((wallet) => (
                <button
                  key={wallet.type}
                  className={`wallet-card ${selectedWallet === wallet.type ? 'loading' : ''}`}
                  onClick={() => handleConnect(wallet.type)}
                  disabled={status === 'connecting'}
                >
                  <div className="wallet-icon">
                    <img src={wallet.iconUrl} alt={wallet.name} />
                  </div>
                  <div className="wallet-info">
                    <h3>{wallet.name}</h3>
                    <p>{wallet.description}</p>
                  </div>
                  {status === 'connecting' && selectedWallet === wallet.type && (
                    <div className="spinner"></div>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="error-state">
                <span className="error-icon">⚠</span>
                <div>
                  <strong>Connection Failed</strong>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

            <div className="security-note">
              <span>🔒</span>
              <p>We never store your private keys. Your wallet remains secure.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
