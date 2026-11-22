import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COMPARISON_SELECTION_STORAGE_KEY } from '../../utils/comparisonSelection';
import { useCompareSelection } from '../useCompareSelection';

describe('useCompareSelection', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('loads persisted selections and limits new selections to two lines', () => {
    window.sessionStorage.setItem(
      COMPARISON_SELECTION_STORAGE_KEY,
      JSON.stringify({ version: 1, ids: ['line-1'] }),
    );
    const { result } = renderHook(() => useCompareSelection());

    expect(result.current.selectedCompareLines).toEqual(['line-1']);
    act(() => {
      result.current.toggleCompareSelection('line-2');
      result.current.toggleCompareSelection('line-3');
    });

    expect(result.current.selectedCompareLines).toEqual(['line-1', 'line-2']);
    expect(window.sessionStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toBe(
      JSON.stringify({ version: 1, ids: ['line-1', 'line-2'] }),
    );
  });

  it('removes a selected line when toggled again', () => {
    const { result } = renderHook(() => useCompareSelection());

    act(() => {
      result.current.toggleCompareSelection('line-1');
      result.current.toggleCompareSelection('line-1');
    });

    expect(result.current.selectedCompareLines).toEqual([]);
  });
});
