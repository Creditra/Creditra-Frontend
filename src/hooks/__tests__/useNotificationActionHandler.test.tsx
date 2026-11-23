/// <reference types="vitest" />
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNotificationActionHandler } from '../useNotificationActionHandler';
import type { NotificationActionDescriptor, NotificationCommandId } from '../../types/notification';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('useNotificationActionHandler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockNavigate.mockReset();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('route actions', () => {
    it('navigates for a valid relative route', () => {
      const { result } = renderHook(() => useNotificationActionHandler());

      act(() => {
        result.current.handleAction({ kind: 'route', label: 'Repay', to: '/repay' });
      });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/repay');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('navigates for a valid route with a query string', () => {
      const { result } = renderHook(() => useNotificationActionHandler());

      act(() => {
        result.current.handleAction({ kind: 'route', label: 'Repay line 1', to: '/repay?line=1' });
      });

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/repay?line=1');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['absolute URL', 'https://evil.test'],
      ['protocol-relative URL', '//evil.test'],
      ['missing leading slash', 'repay'],
    ])('rejects %s (%s) and logs a warning', (_label, to) => {
      const { result } = renderHook(() => useNotificationActionHandler());

      act(() => {
        result.current.handleAction({ kind: 'route', label: 'Go', to });
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Invalid route action ignored:', to);
    });
  });

  describe('command actions', () => {
    it.each<[NotificationCommandId, string]>([
      ['open-wallet', 'open-wallet command executed'],
      ['open-kyc', 'open-kyc command executed'],
      ['retry-sync', 'retry-sync command executed'],
    ])('executes handler for known command %s', (id, expectedLog) => {
      const { result } = renderHook(() => useNotificationActionHandler());

      act(() => {
        result.current.handleAction({ kind: 'command', label: id, id });
      });

      expect(logSpy).toHaveBeenCalledWith(expectedLog);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('warns and does nothing for an unknown command id', () => {
      const { result } = renderHook(() => useNotificationActionHandler());
      const unknownAction = {
        kind: 'command',
        label: 'Unknown',
        id: 'unknown-cmd' as NotificationCommandId,
      } satisfies NotificationActionDescriptor;

      act(() => {
        result.current.handleAction(unknownAction);
      });

      expect(warnSpy).toHaveBeenCalledWith('Unknown command action ignored:', 'unknown-cmd');
      expect(logSpy).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('unsupported and falsy actions', () => {
    it('warns and does not navigate for an unsupported action kind', () => {
      const { result } = renderHook(() => useNotificationActionHandler());
      const unsupportedAction = {
        kind: 'external',
        label: 'External',
      } as unknown as NotificationActionDescriptor;

      act(() => {
        result.current.handleAction(unsupportedAction);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith('Unsupported action kind:', unsupportedAction);
    });

    it('is a no-op when action is undefined', () => {
      const { result } = renderHook(() => useNotificationActionHandler());

      act(() => {
        result.current.handleAction(undefined as unknown as NotificationActionDescriptor);
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
