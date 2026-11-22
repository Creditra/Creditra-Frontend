import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDashboardTour } from '../useDashboardTour';

describe('useDashboardTour', () => {
  it('opens and closes the dashboard explainer', () => {
    const { result } = renderHook(() => useDashboardTour());

    expect(result.current.isExplainOpen).toBe(false);
    act(() => result.current.openExplain());
    expect(result.current.isExplainOpen).toBe(true);
    act(() => result.current.closeExplain());
    expect(result.current.isExplainOpen).toBe(false);
  });
});
