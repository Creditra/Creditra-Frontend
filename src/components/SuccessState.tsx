import React from 'react';
import './SuccessState.css';

interface SuccessStateProps {
  type: 'draw' | 'repay' | 'evaluation';
  transactionId?: string;
  onClose: () => void;
  onViewHistory?: () => void;
}

const SuccessState: React.FC<SuccessStateProps> = ({ 
  type, 
  transactionId, 
  onClose,
  onViewHistory 
}) => {
  const getContent = () => {
    switch (type) {
      case 'draw':
        return {
          title: 'Draw Request Submitted',
          description: 'Your request for a credit draw has been successfully submitted to the Stellar network.',
          nextStep: 'Once the transaction is confirmed, your credit line balance will be updated. This usually takes 5-10 seconds.',
          showHistoryLink: true
        };
      case 'repay':
        return {
          title: 'Repayment Successful',
          description: 'Your repayment has been processed successfully.',
          nextStep: 'Your available credit limit has been restored. You can now request further draws if needed.',
          showHistoryLink: true
        };
      case 'evaluation':
        return {
          title: 'Evaluation Requested',
          description: 'Your credit evaluation request has been sent for analysis.',
          nextStep: 'Our adaptive protocol is analyzing your on-chain activity. Your updated risk score and credit limit will appear on the dashboard shortly.',
          showHistoryLink: false
        };
    }
  };

  const content = getContent();

  return (
    <div className="success-state-container" role="status" aria-live="polite">
      <div className="success-icon-wrapper">
        <div className="success-icon-circle">
          <svg viewBox="0 0 24 24" className="success-checkmark">
            <path d="M4.1 12.7L9 17.6 20.3 6.3" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </div>
      </div>
      
      <h2 className="success-title">{content.title}</h2>
      
      <div className="success-content">
        <p className="success-description">{content.description}</p>
        <div className="success-next-step">
          <strong>What's next?</strong>
          <p>{content.nextStep}</p>
        </div>
      </div>

      <div className="success-actions">
        {content.showHistoryLink && (
          <button 
            className="btn-secondary" 
            onClick={onViewHistory || (() => window.location.hash = '#/history')}
          >
            View Transaction History
          </button>
        )}
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
      
      {transactionId && (
        <a 
          href={`https://stellar.expert/explorer/public/tx/${transactionId}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="explorer-link"
        >
          View on StellarExpert
        </a>
      )}
    </div>
  );
};

export default SuccessState;