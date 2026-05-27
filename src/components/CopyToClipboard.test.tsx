import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COPY_FEEDBACK_DURATION_MS, CopyToClipboard } from './CopyToClipboard';

describe('CopyToClipboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('copies the supplied value and shows temporary feedback', async () => {
    render(
      <CopyToClipboard
        value="GABC123"
        displayValue="GABC123"
        ariaLabel="Copy wallet address"
        variant="surface"
      />,
    );

    const button = screen.getByRole('button', { name: /copy wallet address/i });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('GABC123');

    expect(screen.getByText('Copied')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(COPY_FEEDBACK_DURATION_MS);
    });

    expect(screen.getByText('Copy')).toBeInTheDocument();
  }, 10000);
});
