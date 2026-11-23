import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  COMPARISON_SELECTION_STORAGE_KEY,
  loadComparisonSelection,
  normalizeComparisonSelection,
  saveComparisonSelection,
} from './comparisonSelection';

describe('comparison selection persistence', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps only valid, unique IDs and trims the selection to 2', () => {
    const normalized = normalizeComparisonSelection([
      ' line-1 ',
      'line-1',
      '',
      'line-2',
      'bad id',
      'line-3',
      'line-4',
      'line-4',
    ]);

    expect(normalized).toEqual(['line-1', 'line-2']);
  });

  it('reads persisted selections from sessionStorage and ignores bad payloads', () => {
    sessionStorage.setItem(
      COMPARISON_SELECTION_STORAGE_KEY,
      JSON.stringify({ ids: ['line-1', 'bad id', 'line-2', 'line-2'] }),
    );

    expect(loadComparisonSelection()).toEqual(['line-1', 'line-2']);
  });

  it('writes to sessionStorage and never stores raw user account data in localStorage', () => {
    const persisted = saveComparisonSelection(['line-1', 'line-2']);

    expect(persisted).toBe(true);
    expect(sessionStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toContain('line-1');
    expect(localStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toBeNull();
  });

  it('rejects oversized or malicious IDs without throwing', () => {
    const normalized = normalizeComparisonSelection([
      'a'.repeat(256),
      'line-1',
      'line-2',
      'line;drop table',
    ]);

    expect(normalized).toEqual(['line-1', 'line-2']);
  });

  it('returns false when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded');
    });

    expect(saveComparisonSelection(['line-1', 'line-2'])).toBe(false);
  });
});
