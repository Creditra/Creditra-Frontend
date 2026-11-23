import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  COMPARISON_SELECTION_STORAGE_KEY,
  MAX_COMPARE,
  buildComparisonUrl,
  loadComparisonSelection,
  normalizeComparisonSelection,
  parseComparisonIdsFromSearchParams,
  saveComparisonSelection,
} from './comparisonSelection';

describe('comparison selection persistence and helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps only valid, unique IDs and trims the selection to MAX_COMPARE (4)', () => {
    const normalized = normalizeComparisonSelection([
      ' line-1 ',
      'line-1',
      '',
      'line-2',
      'bad id',
      'line-3',
      'line-4',
      'line-4',
      'line-5',
    ]);

    expect(normalized).toEqual(['line-1', 'line-2', 'line-3', 'line-4']);
  });

  it('reads persisted selections from sessionStorage and ignores bad payloads', () => {
    sessionStorage.setItem(
      COMPARISON_SELECTION_STORAGE_KEY,
      JSON.stringify({ ids: ['line-1', 'bad id', 'line-2', 'line-2', 'line-3'] }),
    );

    expect(loadComparisonSelection()).toEqual(['line-1', 'line-2', 'line-3']);
  });

  it('writes to sessionStorage and never stores raw user account data in localStorage', () => {
    const persisted = saveComparisonSelection(['line-1', 'line-2', 'line-3', 'line-4']);

    expect(persisted).toBe(true);
    expect(sessionStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toContain('line-1');
    expect(sessionStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toContain('line-4');
    expect(localStorage.getItem(COMPARISON_SELECTION_STORAGE_KEY)).toBeNull();
  });

  it('rejects oversized or malicious IDs without throwing', () => {
    const normalized = normalizeComparisonSelection([
      'a'.repeat(256),
      'line-1',
      'line-2',
      'line;drop table',
      'line-3',
      'line-4',
    ]);

    expect(normalized).toEqual(['line-1', 'line-2', 'line-3', 'line-4']);
  });

  it('returns false when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded');
    });

    expect(saveComparisonSelection(['line-1', 'line-2'])).toBe(false);
  });

  describe('parseComparisonIdsFromSearchParams', () => {
    it('parses comma-separated ?ids= param', () => {
      const ids = parseComparisonIdsFromSearchParams('?ids=line-1,line-2,line-3');
      expect(ids).toEqual(['line-1', 'line-2', 'line-3']);
    });

    it('parses up to 4 ids and drops 5th and duplicates', () => {
      const ids = parseComparisonIdsFromSearchParams('?ids=a,b,c,d,e,a,b');
      expect(ids).toEqual(['a', 'b', 'c', 'd']);
    });

    it('falls back to legacy ?a=...&b=... params', () => {
      const ids = parseComparisonIdsFromSearchParams('?a=line-1&b=line-2');
      expect(ids).toEqual(['line-1', 'line-2']);
    });

    it('drops invalid IDs from search params defensively', () => {
      const ids = parseComparisonIdsFromSearchParams('?ids=line-1,invalid id!,line-2');
      expect(ids).toEqual(['line-1', 'line-2']);
    });
  });

  describe('buildComparisonUrl', () => {
    it('creates shareable URL with ?ids=', () => {
      expect(buildComparisonUrl(['line-1', 'line-2', 'line-3'])).toBe(
        '/compare-credit-lines?ids=line-1,line-2,line-3',
      );
    });

    it('returns base path if empty', () => {
      expect(buildComparisonUrl([])).toBe('/compare-credit-lines');
    });
  });
});
