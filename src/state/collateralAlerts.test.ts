import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAlert,
  clearCollateralAlert,
  getLastNotifiedLevel,
  listCollateralAlerts,
  setLastNotifiedLevel,
  COLLATERAL_ALERTS_STORAGE_KEY,
} from './collateralAlerts';

describe('collateral alert storage', () => {
  afterEach(() => localStorage.clear());

  it('stores and retrieves alert level per line', () => {
    expect(getLastNotifiedLevel('CL-001')).toBeNull();

    setLastNotifiedLevel('CL-001', 'warning');
    expect(getLastNotifiedLevel('CL-001')).toBe('warning');
    expect(listCollateralAlerts()).toEqual({ 'CL-001': 'warning' });

    setLastNotifiedLevel('CL-001', 'liquidation');
    expect(getLastNotifiedLevel('CL-001')).toBe('liquidation');
  });

  it('clears alert level when passed null', () => {
    setLastNotifiedLevel('CL-001', 'warning');
    setLastNotifiedLevel('CL-001', null);
    expect(getLastNotifiedLevel('CL-001')).toBeNull();
    expect(listCollateralAlerts()).toEqual({});
  });

  it('clearCollateralAlert removes the alert for a line', () => {
    setLastNotifiedLevel('CL-001', 'warning');
    clearCollateralAlert('CL-001');
    expect(getLastNotifiedLevel('CL-001')).toBeNull();
  });

  it('ignores corrupt and malformed stored values', () => {
    localStorage.setItem(COLLATERAL_ALERTS_STORAGE_KEY, 'null');
    expect(getLastNotifiedLevel('CL-001')).toBeNull();

    localStorage.setItem(COLLATERAL_ALERTS_STORAGE_KEY, JSON.stringify({ 'CL-001': 'invalid_level' }));
    expect(getLastNotifiedLevel('CL-001')).toBeNull();

    localStorage.setItem(COLLATERAL_ALERTS_STORAGE_KEY, JSON.stringify([{ lineId: 'CL-002', level: 'warning' }]));
    expect(getLastNotifiedLevel('CL-002')).toBe('warning');
  });
});
