/**
 * Tests for useQuoteCountdown hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuoteCountdown } from '../useQuoteCountdown';

describe('useQuoteCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns zero and expired for null expiresAt', () => {
    const { result } = renderHook(() => useQuoteCountdown(null));

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(result.current.formattedTime).toBe('0:00');
  });

  it('computes remaining time from expiresAt timestamp', () => {
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60 seconds from now
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    // Should have ~55 seconds remaining (60s - 5s clock skew tolerance)
    expect(result.current.remainingSeconds).toBeGreaterThanOrEqual(54);
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(56);
    expect(result.current.isExpired).toBe(false);
  });

  it('formats time as M:SS', () => {
    const expiresAt = new Date(Date.now() + 125000).toISOString(); // 125 seconds = 2:05
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    // Should be approximately 2:00 (125s - 5s tolerance = 120s)
    expect(result.current.formattedTime).toMatch(/^[12]:\d{2}$/);
  });

  it('updates countdown every second', () => {
    const expiresAt = new Date(Date.now() + 10000).toISOString(); // 10 seconds
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    const initialSeconds = result.current.remainingSeconds;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.remainingSeconds).toBe(initialSeconds - 1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.remainingSeconds).toBe(initialSeconds - 2);
  });

  it('sets isExpired when time runs out', () => {
    const expiresAt = new Date(Date.now() + 6000).toISOString(); // 6 seconds (1s after tolerance)
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    expect(result.current.isExpired).toBe(false);

    // Advance past expiry
    act(() => {
      vi.advanceTimersByTime(7000);
    });

    expect(result.current.isExpired).toBe(true);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it('announces at 15 seconds remaining (only once)', () => {
    const expiresAt = new Date(Date.now() + 20000).toISOString(); // 20 seconds
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    expect(result.current.announcement).toBe('');

    // Advance to exactly 15 seconds remaining (20s - 5s tolerance = 15s initial)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Should announce at 15s
    if (result.current.remainingSeconds === 15) {
      expect(result.current.announcement).toBe('Quote expires in 15 seconds');
    }

    // Advance further
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Announcement should not change after initial announcement
    const announcementAfter = result.current.announcement;
    expect(announcementAfter).toBe('Quote expires in 15 seconds');
  });

  it('applies 5 second clock skew tolerance in favor of expiry', () => {
    const expiresAt = new Date(Date.now() + 6000).toISOString(); // 6 seconds
    const { result } = renderHook(() => useQuoteCountdown(expiresAt));

    // With 5s tolerance, should start at 1 second remaining
    expect(result.current.remainingSeconds).toBeLessThanOrEqual(1);
  });

  it('resets announcement when new quote arrives', () => {
    const expiresAt1 = new Date(Date.now() + 20000).toISOString();
    const { result, rerender } = renderHook(
      ({ expiresAt }) => useQuoteCountdown(expiresAt),
      { initialProps: { expiresAt: expiresAt1 } },
    );

    // Advance to trigger announcement
    act(() => {
      vi.advanceTimersByTime(6000);
    });

    // New quote arrives
    const expiresAt2 = new Date(Date.now() + 30000).toISOString();
    rerender({ expiresAt: expiresAt2 });

    expect(result.current.announcement).toBe('');
  });

  it('handles invalid date strings', () => {
    const { result } = renderHook(() => useQuoteCountdown('invalid-date'));

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isExpired).toBe(true);
  });
});
