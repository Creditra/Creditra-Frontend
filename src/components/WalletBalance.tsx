import { useEffect, useRef } from 'react';
import { useWallet, type BalanceInfo } from '../context/WalletContext';
import { usePageVisible } from '../hooks/usePageVisible';
import { SETTLEMENT_ASSET } from '../lib/repayable-balance';
import type { HorizonStreamStatus } from '../services/horizonStream';
import { Amount } from './Amount';
import './WalletBalance.css';

const STREAM_STATUS_LABELS: Record<HorizonStreamStatus, string> = {
  live: 'Live',
  reconnecting: 'Reconnecting…',
  polling: 'Polling',
};

const XLM_CODE = 'XLM';
const USDC_CODE = 'USDC';
const XLM_DECIMALS = 4;
const USDC_DECIMALS = 2;

/**
 * Trim a Horizon balance string to a fixed precision using string operations
 * only. Going through `Number`/`toFixed` would introduce float drift on the
 * large, 7-decimal values returned by Horizon.
 */
function formatFixedBalance(value: string, decimals: number): string {
  const raw = value.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return raw === '' ? '0' : raw;

  const [, sign, whole, fraction = ''] = match;
  if (decimals === 0) return `${sign}${whole}`;

  const digits = fraction.padEnd(decimals, '0').slice(0, decimals);
  return `${sign}${whole}.${digits}`;
}

/**
 * `getCreditNetworkConfig` exposes no issuer, so use the app's configured
 * settlement issuer when it matches USDC; otherwise fall back to the first
 * trustline with the USDC code.
 */
function findUsdcBalance(balances: BalanceInfo[]): BalanceInfo | undefined {
  const candidates = balances.filter((balance) => balance.asset === USDC_CODE);
  if (candidates.length === 0) return undefined;

  const configuredIssuer =
    SETTLEMENT_ASSET.code === USDC_CODE ? SETTLEMENT_ASSET.issuer : undefined;
  return (
    (configuredIssuer &&
      candidates.find((balance) => balance.issuer === configuredIssuer)) ||
    candidates[0]
  );
}

export function WalletBalance() {
  const { wallet, status, balances, refreshBalance, streamStatus = 'live' } = useWallet();
  const isVisible = usePageVisible();
  const wasHiddenRef = useRef(false);

  useEffect(() => {
    if (!isVisible) {
      wasHiddenRef.current = true;
      return;
    }

    if (status !== 'connected' || !wallet) return;

    if (wasHiddenRef.current) {
      wasHiddenRef.current = false;
      refreshBalance();
      return;
    }

    // Initial fetch if no balances yet; subsequent updates arrive via Horizon SSE stream.
    if (!balances) {
      refreshBalance();
    }
  }, [status, wallet, refreshBalance, balances, isVisible]);

  if (status !== 'connected' || !balances) return null;

  const xlmBalance = balances.find((balance) => balance.asset === XLM_CODE);
  const usdcBalance = findUsdcBalance(balances);
  const statusLabel = STREAM_STATUS_LABELS[streamStatus];

  return (
    <div className="wallet-balance" role="group" aria-label="Wallet Balance">
      <span className="wallet-balance-values">
        <span className="wallet-balance-amount">
          <span className="sr-only">XLM balance: </span>
          <Amount
            value={xlmBalance?.balance ?? '0'}
            format={(value) => formatFixedBalance(value, XLM_DECIMALS)}
            symbol={XLM_CODE}
            maskedLabel="XLM balance hidden for privacy"
          />
        </span>
        <span className="wallet-balance-divider" aria-hidden="true">·</span>
        <span
          className={`wallet-balance-amount${usdcBalance ? '' : ' wallet-balance-amount--missing'}`}
        >
          <span className="sr-only">USDC balance: </span>
          <Amount
            value={usdcBalance?.balance ?? '0'}
            format={(value) => formatFixedBalance(value, USDC_DECIMALS)}
            symbol={USDC_CODE}
            maskedLabel="USDC balance hidden for privacy"
          />
          {!usdcBalance && (
            <span className="wallet-balance-note">No USDC trustline</span>
          )}
        </span>
      </span>
      <span
        className={`wallet-balance-indicator wallet-balance-indicator--${streamStatus}`}
        role="status"
        aria-label={`Balance stream: ${statusLabel}`}
        title={statusLabel}
      />
    </div>
  );
}
