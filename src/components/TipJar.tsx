import { useState } from 'react';
import { Coins, Sparkles, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { useCreditLines } from '../hooks/useCreditLines';
import type { CreditLine } from '../types/creditLine';
import { fmt } from '../utils/tokens';
import './TipJar.css';

interface TipJarProps {
  onRepaySuccess?: (amount: number, lineName: string) => void;
}

export function TipJar({ onRepaySuccess }: TipJarProps) {
  const { lines, setLines } = useCreditLines();
  const [step, setStep] = useState<'idle' | 'processing' | 'success'>('idle');
  const [processingAmount, setProcessingAmount] = useState<number | null>(null);
  const [successAmount, setSuccessAmount] = useState<number | null>(null);
  const [successLineName, setSuccessLineName] = useState<string>('');

  // Find active/suspended credit lines with an outstanding balance
  const activeLinesWithBalance = lines.filter(
    (cl) => (cl.status === 'Active' || cl.status === 'Suspended') && cl.utilized > 0
  );

  // Target the line with the highest APR to save the most interest
  const targetLine = [...activeLinesWithBalance].sort((a, b) => b.apr - a.apr)[0];

  if (!targetLine) {
    return (
      <div className="tip-jar-container tip-jar-empty" role="region" aria-label="Tip Jar">
        <div className="tip-jar-icon-wrapper">
          <CheckCircle2 className="tip-jar-icon success" aria-hidden="true" />
        </div>
        <div className="tip-jar-content">
          <h3 className="tip-jar-title">All Caught Up!</h3>
          <p className="tip-jar-description">
            You have no outstanding balances. Great job keeping your credit utilization at 0%!
          </p>
        </div>
      </div>
    );
  }

  const quickAmounts = [10, 25, 50, 100];
  const maxRepayable = targetLine.utilized;

  const handleOneTapRepay = (amount: number) => {
    const actualAmount = Math.min(amount, maxRepayable);
    setProcessingAmount(actualAmount);
    setStep('processing');

    // Simulate blockchain/network transaction delay
    setTimeout(() => {
      // Append to transactions
      const txHash = '0x' + Array.from({ length: 32 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const updatedLine: CreditLine = {
        ...targetLine,
        utilized: Math.max(0, targetLine.utilized - actualAmount),
        updatedAt: new Date().toISOString(),
        transactions: [{
        id: `TX-TIP-${Date.now()}`,
        type: 'Repay',
        amount: actualAmount,
        date: new Date().toISOString(),
        note: `Tip Jar Micro-Repayment (${targetLine.name})`,
        status: 'Completed',
        txHash,
        }, ...targetLine.transactions],
      };
      setLines(lines.map((line) => line.id === targetLine.id ? updatedLine : line));

      setSuccessAmount(actualAmount);
      setSuccessLineName(targetLine.name);
      setStep('success');

      if (onRepaySuccess) {
        onRepaySuccess(actualAmount, targetLine.name);
      }
    }, 1500);
  };

  const handleReset = () => {
    setStep('idle');
    setProcessingAmount(null);
    setSuccessAmount(null);
    setSuccessLineName('');
  };

  return (
    <div 
      className="tip-jar-container" 
      role="region" 
      aria-label="Tip Jar Nudges"
    >
      <div className="tip-jar-glow" />
      
      {step === 'idle' && (
        <>
          <div className="tip-jar-header">
            <div className="tip-jar-icon-wrapper">
              <Coins className="tip-jar-icon" aria-hidden="true" />
              <Sparkles className="tip-jar-sparkle-icon" aria-hidden="true" />
            </div>
            <div className="tip-jar-intro">
              <span className="tip-jar-kicker">GrantFox Campaign · FICO Nudge</span>
              <h3 className="tip-jar-title">Credit Tip Jar</h3>
            </div>
          </div>
          
          <div className="tip-jar-content">
            <p className="tip-jar-description">
              Make a quick micro-repayment on your <strong>{targetLine.name}</strong> (highest APR: {targetLine.apr}%). 
              Even small payments reduce utilization and save interest!
            </p>
            
            <div className="tip-jar-actions">
              <span className="tip-jar-actions-label">One-tap repay:</span>
              <div className="tip-jar-buttons-group">
                {quickAmounts.map((amount) => {
                  const isDisabled = maxRepayable <= 0;
                  const displayAmount = Math.min(amount, maxRepayable);
                  
                  return (
                    <button
                      key={amount}
                      type="button"
                      className="tip-jar-action-btn"
                      onClick={() => handleOneTapRepay(displayAmount)}
                      disabled={isDisabled}
                      aria-label={`Repay ${fmt(displayAmount)} immediately to ${targetLine.name}`}
                    >
                      {fmt(displayAmount)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {step === 'processing' && (
        <div className="tip-jar-state-container" aria-live="polite" aria-busy="true">
          <Loader2 className="tip-jar-spinner" aria-hidden="true" />
          <div className="tip-jar-state-content">
            <h4 className="tip-jar-state-title">Processing Micro-Repayment</h4>
            <p className="tip-jar-state-desc">
              Submitting one-tap payment of <strong>{fmt(processingAmount || 0)}</strong> to the network...
            </p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="tip-jar-state-container" aria-live="polite">
          <CheckCircle2 className="tip-jar-success-icon" aria-hidden="true" />
          <div className="tip-jar-state-content">
            <h4 className="tip-jar-state-title">Repayment Confirmed!</h4>
            <p className="tip-jar-state-desc">
              Successfully repaid <strong>{fmt(successAmount || 0)}</strong> on {successLineName}. Your utilization has decreased.
            </p>
            <button 
              type="button" 
              className="tip-jar-reset-btn" 
              onClick={handleReset}
              aria-label="Dismiss success message and show tip jar again"
            >
              Dismiss <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
