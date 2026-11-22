import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useNotificationActionHandler } from './useNotificationActionHandler';
import type { NotificationActionDescriptor } from '../types/notification';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('useNotificationActionHandler', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockNavigate.mockReset();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('navigates for valid relative route actions', () => {
    const { result } = renderHook(() => useNotificationActionHandler());

    result.current.handleAction({
      kind: 'route',
      label: 'View details',
      to: '/credit-lines/123',
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/credit-lines/123');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('ignores unsafe route containing protocol (://)', () => {
    const { result } = renderHook(() => useNotificationActionHandler());

    result.current.handleAction({
      kind: 'route',
      label: 'External',
      to: 'https://evil.example/phish',
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid route action ignored:',
      'https://evil.example/phish'
    );
  });

  it('ignores unsafe route containing :// even when starting with /', () => {
    const { result } = renderHook(() => useNotificationActionHandler());

    result.current.handleAction({
      kind: 'route',
      label: 'Bypass',
      to: '/redirect?next=https://evil.example',
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid route action ignored:',
      '/redirect?next=https://evil.example'
    );
  });

  it('ignores unsafe route not starting with /', () => {
    const { result } = renderHook(() => useNotificationActionHandler());

    result.current.handleAction({
      kind: 'route',
      label: 'Relative',
      to: 'dashboard/settings',
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Invalid route action ignored:',
      'dashboard/settings'
    );
  });

  it('warns without throwing for unknown command ids', () => {
    const { result } = renderHook(() => useNotificationActionHandler());

    const unknownCommand = {
      kind: 'command',
      label: 'Mystery',
      id: 'unknown-command',
    } as unknown as NotificationActionDescriptor;

    expect(() => result.current.handleAction(unknownCommand)).not.toThrow();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Unknown command action ignored:',
      'unknown-command'
    );
  });
});
