import React, { useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
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

export const WalletConnectionModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const modalRef = useFocusTrap(isOpen);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="presentation">
      <div 
        ref={modalRef}
        className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h2 id="modal-title">Connect Wallet</h2>
          <button className="close-btn" onClick={handleClose} aria-label="Close modal">×</button>
        </div>

        {status === 'connected' ? (
          <div className="success-state" role="status">
            <div className="success-icon" aria-hidden="true">✓</div>
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
              <div className="error-state" role="alert">
                <span className="error-icon" aria-hidden="true">⚠</span>
                <div>
                  <strong>Connection Failed</strong>
                  <p>{error.message}</p>
                </div>
              </div>
            )}

            <div className="security-note">
              <span aria-hidden="true">🔒</span>
              <p>We never store your private keys. Your wallet remains secure.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
