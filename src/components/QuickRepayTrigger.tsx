import React, { useState, useRef } from 'react';
import { useWallet } from '../context/WalletContext';
import { MOCK_CREDIT_LINES } from '../data/mockData';
import { QuickRepayModal } from './QuickRepayModal';
import { getRepayableBalance, moneyToNumber, SETTLEMENT_ASSET } from '../lib/repayable-balance';

export const QuickRepayTrigger = () => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { balances, status, wallet } = useWallet();
  const repayableBalance = getRepayableBalance(balances, SETTLEMENT_ASSET);
  const walletBalance =
    repayableBalance.status === 'ok' ? moneyToNumber(repayableBalance.amount) : null;

  const hasOpenLine = MOCK_CREDIT_LINES.some(cl => cl.status !== 'Closed');
  if (!hasOpenLine) return null;

  const linesWithBalance = MOCK_CREDIT_LINES.filter(cl => cl.utilized > 0);
  const mostRecentLine = linesWithBalance.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  if (!mostRecentLine) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="header-nav-link"
        style={{
          height: 44,
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(63,185,80,0.1)',
          color: '#3fb950',
          borderRadius: 6,
          fontWeight: 600,
          border: '1px solid rgba(63,185,80,0.3)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => setIsOpen(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(63,185,80,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(63,185,80,0.1)';
        }}
      >
        Quick Repay
      </button>
      {isOpen && (
        <QuickRepayModal
          creditLine={mostRecentLine}
          walletBalance={walletBalance}
          balanceStatus={repayableBalance.status}
          walletConnected={status === 'connected' && wallet !== null}
          initialAmount={mostRecentLine.utilized.toString()}
          onClose={() => setIsOpen(false)}
          onSuccess={() => setIsOpen(false)}
          triggerRef={triggerRef}
        />
      )}
    </>
  );
};
