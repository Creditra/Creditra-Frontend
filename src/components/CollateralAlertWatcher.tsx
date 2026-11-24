import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { useCreditData } from '../context/CreditDataContext';
import {
  computeLtvSnapshot,
  evaluateLtvAlert,
  findAssetByName,
  fmtLtv,
  isUpwardCrossing,
} from '../utils/collateral';
import {
  getLastNotifiedLevel,
  setLastNotifiedLevel,
  COLLATERAL_ALERTS_CHANGE_EVENT,
  COLLATERAL_ALERTS_STORAGE_KEY,
} from '../state/collateralAlerts';
import type { CreditLine } from '../types/creditLine';

export interface CollateralAlertWatcherProps {
  lines?: CreditLine[];
  intervalMs?: number;
}

/**
 * Headless watcher component mounted in AppShell.
 * Evaluates collateral LTV per credit line and emits notifications when
 * warning and liquidation thresholds are crossed upward.
 *
 * - Only notifies on upward crossings.
 * - Recovery re-arms alerts.
 * - Deduplicates across re-renders and reloads via persistent storage.
 * - Ignores lines without collateral.
 */
export function CollateralAlertWatcher({ lines: propLines, intervalMs = 5000 }: CollateralAlertWatcherProps = {}) {
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const creditData = useCreditData();

  const lines = propLines ?? creditData.lines;
  const linesRef = useRef(lines);
  linesRef.current = lines;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const check = () => {
      const currentLines = linesRef.current;
      if (!currentLines || !currentLines.length) return;

      for (const line of currentLines) {
        // Acceptance criteria: Lines without collateral are ignored.
        if (!line.collateral || !line.collateral.trim()) continue;

        const asset = findAssetByName(line.collateral);
        if (!asset) continue;

        const snapshot = computeLtvSnapshot(asset, line.utilized);
        const prevLevel = getLastNotifiedLevel(line.id);
        const newLevel = evaluateLtvAlert(prevLevel, snapshot.ltvRatio);

        if (newLevel !== prevLevel) {
          if (isUpwardCrossing(prevLevel, newLevel) && newLevel !== null) {
            const isLiquidation = newLevel === 'liquidation';
            const title = isLiquidation ? 'Liquidation risk alert' : 'Collateral warning';
            const message = isLiquidation
              ? `${line.name} LTV reached ${fmtLtv(snapshot.ltvRatio)} (collateral: ${asset.name}). Add collateral or repay now to avoid liquidation.`
              : `${line.name} LTV reached ${fmtLtv(snapshot.ltvRatio)} (collateral: ${asset.name}). Consider adding collateral or repaying balance.`;

            addToast({
              type: isLiquidation ? 'danger' : 'warning',
              category: 'credit_line',
              title,
              message,
              action: {
                label: 'Add collateral / repay',
                onClick: () => navigate('/credit-lines'),
              },
              actionDescriptor: {
                label: 'Add collateral / repay',
                kind: 'route',
                to: '/credit-lines',
              },
            });
          }

          setLastNotifiedLevel(line.id, newLevel);
        }
      }
    };

    // Initial check on mount or when dependencies change
    check();

    // Polling interval
    if (intervalMs > 0) {
      interval = setInterval(check, intervalMs);
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === COLLATERAL_ALERTS_STORAGE_KEY || event.key === null) {
        check();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(COLLATERAL_ALERTS_CHANGE_EVENT, check);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COLLATERAL_ALERTS_CHANGE_EVENT, check);
      if (interval) clearInterval(interval);
    };
  }, [addToast, navigate, intervalMs, lines]);

  return null;
}
