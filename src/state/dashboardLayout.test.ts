import { beforeEach, describe, expect, it } from 'vitest';
import {
  dashboardLayoutStorageKey,
  loadDashboardLayout,
  normalizeDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from './dashboardLayout';

const CARD_IDS = ['summary', 'activity', 'health-tips'];

describe('dashboard layout state', () => {
  beforeEach(() => localStorage.clear());

  it('persists layouts per wallet', () => {
    saveDashboardLayout(
      'wallet-a',
      { order: ['activity', 'summary', 'health-tips'], hidden: ['summary'] },
      CARD_IDS,
    );

    expect(loadDashboardLayout('wallet-a', CARD_IDS)).toEqual({
      order: ['activity', 'summary', 'health-tips'],
      hidden: ['summary'],
    });
    expect(loadDashboardLayout('wallet-b', CARD_IDS)).toEqual({
      order: CARD_IDS,
      hidden: [],
    });
  });

  it('ignores unknown ids and appends new cards', () => {
    expect(
      normalizeDashboardLayout(
        {
          order: ['activity', 'removed', 'activity'],
          hidden: ['removed', 'health-tips', 'health-tips'],
        },
        CARD_IDS,
      ),
    ).toEqual({
      order: ['activity', 'summary', 'health-tips'],
      hidden: ['health-tips'],
    });
  });

  it('restores hidden cards and resets to defaults', () => {
    saveDashboardLayout(
      'wallet-a',
      { order: ['health-tips', 'summary', 'activity'], hidden: ['activity'] },
      CARD_IDS,
    );
    expect(loadDashboardLayout('wallet-a', CARD_IDS).hidden).toEqual(['activity']);

    expect(resetDashboardLayout('wallet-a', CARD_IDS)).toEqual({ order: CARD_IDS, hidden: [] });
    expect(dashboardLayoutStorageKey('wallet-a')).toBe('creditra.dashboard-layout.wallet-a');
  });
});
