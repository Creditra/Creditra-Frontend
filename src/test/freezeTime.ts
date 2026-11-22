import { vi } from 'vitest';

export function freezeTime(isoDate: string): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoDate));
}

export function restoreTime(): void {
  vi.useRealTimers();
}
