import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import './RepaySuccessShareCard.css';
import { Share2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { fmt } from '../utils/tokens';

interface RepaySuccessShareCardProps {
  amount: number;
  creditLineName: string;
  transactionId: string;
  timestamp: Date;
  onClose?: () => void;
}

export const RepaySuccessShareCard: React.FC<RepaySuccessShareCardProps> = ({
  amount,
  creditLineName,
  transactionId,
  timestamp,
  onClose,
}) => {
  const [isMasked, setIsMasked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = useTheme();

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    },
    [],
  );

  const maskText = (text: string, visibleStart = 4, visibleEnd = 4) => {
    if (!isMasked) return text;
    if (text.length <= visibleStart + visibleEnd) return text;
    return `${text.slice(0, visibleStart)}••••${text.slice(-visibleEnd)}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleShare = async () => {
    const shareText = `Repaid ${fmt(amount)} on ${creditLineName} (${transactionId})`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Repayment Successful',
          text: shareText,
        });
      } catch {
        // Fallback to copy
        copyToClipboard();
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    const shareText = `Repaid ${fmt(amount)} on ${creditLineName} (${transactionId})`;
    try {
      await navigator.clipboard.writeText(shareText);
      setIsCopied(true);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        copiedTimeoutRef.current = null;
      }, 2000);
    } catch {
      // Ignore errors
    }
  };

  return (
    <div className={`repay-share-card repay-share-card--${theme}`}>
      <div className="repay-share-header">
        <CheckCircle2 className="repay-check-icon" aria-hidden="true" />
        <h2 className="repay-title">Repayment Successful!</h2>
        <p className="repay-subtitle">Your credit has been restored</p>
      </div>

      <div className="repay-share-content">
<div className="repay-info-row">
          <span className="repay-label">Amount</span>
          <span className="repay-value tabular-nums">{fmt(amount)}</span>
        </div>
        <div className="repay-info-row">
          <span className="repay-label">Credit Line</span>
          <span className="repay-value">{isMasked ? maskText(creditLineName, 2, 2) : creditLineName}</span>
        </div>
        <div className="repay-info-row">
          <span className="repay-label">Transaction ID</span>
          <span className="repay-value">{maskText(transactionId, 6, 4)}</span>
        </div>
        <div className="repay-info-row">
          <span className="repay-label">Date</span>
          <span className="repay-value">{formatDate(timestamp)}</span>
        </div>
      </div>

      <div className="repay-share-actions">
        <button
          type="button"
          className="repay-btn repay-btn--secondary"
          onClick={() => setIsMasked(!isMasked)}
          aria-label={isMasked ? 'Show details' : 'Mask details'}
        >
          {isMasked ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
          {isMasked ? 'Show Details' : 'Mask Details'}
        </button>
        <button
          type="button"
          className="repay-btn repay-btn--primary"
          onClick={handleShare}
          aria-label="Share repayment summary"
        >
          {isCopied ? <CheckCircle2 size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
          {isCopied ? 'Copied!' : 'Share'}
        </button>
      </div>

      {onClose && (
        <button
          type="button"
          className="repay-close-btn"
          onClick={onClose}
          aria-label="Close share card"
        >
          Close
        </button>
      )}
    </div>
  );
};
