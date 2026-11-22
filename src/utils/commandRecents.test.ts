import { describe, it, expect, beforeEach } from 'vitest';
import { COMMAND_PALETTE_RECENTS_KEY } from '../constants/storageKeys';
import { getRecentIds, recordRecent } from './commandRecents';

describe('commandRecents', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns an empty array when nothing is stored', () => {
    expect(getRecentIds()).toEqual([]);
  });

  it('records recent ids in most-recent-first order', () => {
    recordRecent('nav-transactions');
    recordRecent('nav-help');
    expect(getRecentIds()).toEqual(['nav-help', 'nav-transactions']);
  });

  it('moves an existing id to the front and de-duplicates', () => {
    recordRecent('a');
    recordRecent('b');
    recordRecent('c');
    const updated = recordRecent('a');
    expect(updated).toEqual(['a', 'c', 'b']);
    expect(getRecentIds()).toEqual(['a', 'c', 'b']);
  });

  it('caps the list at 5 items by default', () => {
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => recordRecent(id));
    expect(getRecentIds()).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('respects a custom max cap', () => {
    recordRecent('a', 3);
    recordRecent('b', 3);
    recordRecent('c', 3);
    recordRecent('d', 3);
    expect(getRecentIds()).toEqual(['d', 'c', 'b']);
  });

  it('ignores empty string ids', () => {
    recordRecent('a');
    expect(recordRecent('')).toEqual(['a']);
    expect(getRecentIds()).toEqual(['a']);
  });

  it('tolerates corrupt JSON in localStorage', () => {
    window.localStorage.setItem(COMMAND_PALETTE_RECENTS_KEY, '{not-valid-json');
    expect(getRecentIds()).toEqual([]);
  });

  it('tolerates non-array JSON values in localStorage', () => {
    window.localStorage.setItem(COMMAND_PALETTE_RECENTS_KEY, JSON.stringify({ id: 'a' }));
    expect(getRecentIds()).toEqual([]);
  });

  it('filters out invalid entries and duplicates from stored arrays', () => {
    window.localStorage.setItem(
      COMMAND_PALETTE_RECENTS_KEY,
      JSON.stringify(['a', 123, null, '', 'b', 'a']),
    );
    expect(getRecentIds()).toEqual(['a', 'b']);
  });
});
