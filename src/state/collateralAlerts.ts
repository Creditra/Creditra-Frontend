import { readJson, writeJson } from '../utils/storage';
import type { CollateralAlertLevel } from '../utils/collateral';

const STORAGE_KEY = 'creditra_collateral_alerts_v1';
export const COLLATERAL_ALERTS_CHANGE_EVENT = 'creditra:collateral-alerts-change';
export const COLLATERAL_ALERTS_STORAGE_KEY = STORAGE_KEY;

export type { CollateralAlertLevel };

function notifyChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COLLATERAL_ALERTS_CHANGE_EVENT));
  }
}

function getStoredMap(): Record<string, CollateralAlertLevel> {
  const raw = readJson<unknown>(STORAGE_KEY, {});
  if (!raw || typeof raw !== 'object') return {};

  const result: Record<string, CollateralAlertLevel> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as { lineId?: unknown }).lineId === 'string' &&
        ((item as { level?: unknown }).level === 'warning' ||
          (item as { level?: unknown }).level === 'liquidation')
      ) {
        result[(item as { lineId: string }).lineId] = (item as { level: CollateralAlertLevel }).level;
      }
    }
    return result;
  }

  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (val === 'warning' || val === 'liquidation') {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Returns the last notified alert level for a given credit line.
 */
export function getLastNotifiedLevel(lineId: string): CollateralAlertLevel | null {
  if (!lineId) return null;
  const map = getStoredMap();
  return map[lineId] ?? null;
}

/**
 * Persists the last notified alert level for a credit line.
 * Passing null removes the line from stored alerts (e.g. after recovery).
 */
export function setLastNotifiedLevel(
  lineId: string,
  level: CollateralAlertLevel | null
): void {
  if (!lineId) return;
  const map = getStoredMap();
  if (level === null) {
    if (!(lineId in map)) return;
    delete map[lineId];
  } else {
    if (map[lineId] === level) return;
    map[lineId] = level;
  }
  writeJson(STORAGE_KEY, map);
  notifyChange();
}

/**
 * Clears the stored alert level for a line (re-arming it).
 */
export function clearCollateralAlert(lineId: string): void {
  setLastNotifiedLevel(lineId, null);
}

/**
 * Returns all active stored collateral alerts as a lineId -> level mapping.
 */
export function listCollateralAlerts(): Record<string, CollateralAlertLevel> {
  return getStoredMap();
}

// Aliases for convenience and caller compatibility
export const getAlertLevel = getLastNotifiedLevel;
export const setAlertLevel = setLastNotifiedLevel;
export const clearAlert = clearCollateralAlert;
