import { readJson, writeJson } from '../utils/storage';

export interface DashboardLayout {
  order: string[];
  hidden: string[];
}

export const DASHBOARD_LAYOUT_STORAGE_PREFIX = 'creditra.dashboard-layout.';

export function dashboardLayoutStorageKey(walletKey: string | null): string | null {
  return walletKey ? `${DASHBOARD_LAYOUT_STORAGE_PREFIX}${walletKey}` : null;
}

export function normalizeDashboardLayout(
  layout: DashboardLayout | null | undefined,
  cardIds: readonly string[],
): DashboardLayout {
  const known = new Set(cardIds);
  const requestedOrder = Array.isArray(layout?.order) ? layout.order : [];
  const order: string[] = [];

  for (const id of requestedOrder) {
    if (typeof id === 'string' && known.has(id) && !order.includes(id)) {
      order.push(id);
    }
  }
  for (const id of cardIds) {
    if (!order.includes(id)) order.push(id);
  }

  const hidden: string[] = [];
  if (Array.isArray(layout?.hidden)) {
    for (const id of layout.hidden) {
      if (typeof id === 'string' && known.has(id) && !hidden.includes(id)) {
        hidden.push(id);
      }
    }
  }

  return { order, hidden };
}

export function defaultDashboardLayout(cardIds: readonly string[]): DashboardLayout {
  return { order: [...cardIds], hidden: [] };
}

export function loadDashboardLayout(
  walletKey: string | null,
  cardIds: readonly string[],
): DashboardLayout {
  if (!walletKey) return defaultDashboardLayout(cardIds);
  const key = dashboardLayoutStorageKey(walletKey);
  const stored = key ? readJson<unknown>(key, null) : null;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return defaultDashboardLayout(cardIds);
  }
  return normalizeDashboardLayout(stored as DashboardLayout, cardIds);
}

export function saveDashboardLayout(
  walletKey: string | null,
  layout: DashboardLayout,
  cardIds: readonly string[],
): DashboardLayout {
  const normalized = normalizeDashboardLayout(layout, cardIds);
  const key = dashboardLayoutStorageKey(walletKey);
  if (key) writeJson(key, normalized);
  return normalized;
}

export function resetDashboardLayout(
  walletKey: string | null,
  cardIds: readonly string[],
): DashboardLayout {
  const layout = defaultDashboardLayout(cardIds);
  return saveDashboardLayout(walletKey, layout, cardIds);
}

export const getDashboardLayout = loadDashboardLayout;
export const readDashboardLayout = loadDashboardLayout;
export const writeDashboardLayout = saveDashboardLayout;
