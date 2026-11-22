import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import { useDraftSaveStatus } from '../useDraftSaveStatus';
import { DraftSavedIndicator } from '@/components/DraftSavedIndicator';

describe('useDraftSaveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle state with savedAt null', () => {
    const { result } = renderHook(() => useDraftSaveStatus());
    expect(result.current.status).toBe('idle');
    expect(result.current.savedAt).toBeNull();
  });

  it('debounces rapid markSaved calls into a single saved transition', () => {
    const { result } = renderHook(() => useDraftSaveStatus(500));

    act(() => {
      result.current.markSaved();
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.markSaved();
    });
    act(() => {
      vi.advanceTimersByTime(200);
      result.current.markSaved();
    });

    // Still idle before the final debounce window elapses
    expect(result.current.status).toBe('idle');
    expect(result.current.savedAt).toBeNull();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.savedAt).toBe(Date.now());
  });

  it('transitions to error state after debounce on markError', () => {
    const { result } = renderHook(() => useDraftSaveStatus(500));

    act(() => {
      result.current.markError();
    });

    expect(result.current.status).toBe('idle');

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.savedAt).toBeNull();
  });

  it('immediately resets to idle and cancels pending timers on reset()', () => {
    const { result } = renderHook(() => useDraftSaveStatus(500));

    act(() => {
      result.current.markSaved();
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe('saved');

    act(() => {
      result.current.markSaved();
      vi.advanceTimersByTime(200);
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.savedAt).toBeNull();

    // Advancing past the cancelled timer does not re-set status
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.status).toBe('idle');
  });
});

describe('DraftSavedIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when status is idle', () => {
    const { container } = render(
      <DraftSavedIndicator status="idle" savedAt={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Saved just now" and updates relative text over time', () => {
    const savedAt = Date.now();
    render(<DraftSavedIndicator status="saved" savedAt={savedAt} />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
    expect(statusEl).toHaveTextContent('Saved just now');

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(screen.getByRole('status')).toHaveTextContent('Saved 2 minutes ago');
  });

  it('renders error state when status is error', () => {
    render(<DraftSavedIndicator status="error" savedAt={null} />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
    expect(statusEl).toHaveTextContent("Couldn't save draft");
  });
});
