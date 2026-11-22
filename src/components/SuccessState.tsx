import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SuccessState.css';
import { RepaySuccessShareCard } from './RepaySuccessShareCard';
import { getExplorerTxUrl } from '../utils/wallet';

interface SuccessStateProps {
  /**
   * Which flow just completed. Drives the copy: a draw confirms a
   * disbursement, a repay confirms a balance restore, an evaluation
   * confirms the request was queued.
   */
  type: 'draw' | 'repay' | 'evaluation';
  /** When supplied, surfaced so the user can copy a reference for support. */
  transactionId?: string;
  /** When repay flow, amount repaid */
  amount?: number;
  /** When repay flow, credit line name */
  creditLineName?: string;
  /** Dismiss the success state and return to the dashboard. */
  onClose: () => void;
  /**
   * Optional handler for "view in history". When omitted the link is
   * not rendered. The evaluation flow omits it because no transaction
   * record exists yet at that point.
   */
  onViewHistory?: () => void;
}

/**
 * Post-action confirmation surface shown after a draw, repay, or
 * evaluation submission.
 *
 * The container carries `role="status" aria-live="polite"` so screen
 * readers announce the success without preempting the user's next
 * keystroke. The visual is a single accent checkmark with two paragraphs
 * (what happened + what comes next) and an action pair.
 *
 * Purely presentational. The parent flow owns navigation and side
 * effects; this component only renders the chosen copy and forwards the
 * close/view-history callbacks.
 */
const SuccessState: React.FC<SuccessStateProps> = ({
  type,
  transactionId,
  amount,
  creditLineName,
  onClose,
  onViewHistory
}) => {
  const navigate = useNavigate();
  const [showShareCard, setShowShareCard] = useState(false);

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

  if (showShareCard && type === 'repay' && amount && creditLineName && transactionId) {
    return (
      <div className="success-state-container" role="status" aria-live="polite">
        <RepaySuccessShareCard
          amount={amount}
          creditLineName={creditLineName}
          transactionId={transactionId}
          timestamp={new Date()}
          onClose={() => setShowShareCard(false)}
        />
      </div>
    );
  }

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
            onClick={onViewHistory || (() => navigate('/transactions'))}
          >
            View Transaction History
          </button>
        )}
        {type === 'repay' && (
          <button 
            className="btn-secondary" 
            onClick={() => setShowShareCard(true)}
          >
            Share Summary
          </button>
        )}
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
      
      {transactionId && (
        <a 
          href={getExplorerTxUrl(transactionId)} 
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