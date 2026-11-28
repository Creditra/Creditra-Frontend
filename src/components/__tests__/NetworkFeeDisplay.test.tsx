import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useNetworkFee: vi.fn(),
  buildCreditInvocationArgs: vi.fn((lineId: string, amount: number) => ({
    lineId,
    amount,
  })),
}));

vi.mock('../../hooks/useNetworkFee', () => ({
  useNetworkFee: mocks.useNetworkFee,
}));

vi.mock('../../services/fees', () => ({
  buildCreditInvocationArgs: mocks.buildCreditInvocationArgs,
  formatFeeXlm: (stroops: number) => `${stroops} stroops`,
  isFeeEstimationConfigured: () => true,
}));

import { NetworkFeeDisplay } from '../NetworkFeeDisplay';

beforeEach(() => {
  mocks.useNetworkFee.mockReset();
  mocks.buildCreditInvocationArgs.mockClear();
});

describe('NetworkFeeDisplay', () => {
  it('renders the estimated fee with units', () => {
    mocks.useNetworkFee.mockReturnValue({
      status: 'ready',
      estimate: { totalStroops: 12595 },
    });

    render(
      <NetworkFeeDisplay method="draw" lineId="line-1" amount={100} testId="fee" />,
    );

    expect(screen.getByTestId('fee')).toHaveTextContent('12595 stroops');
    expect(screen.getByTestId('fee')).toHaveAttribute('data-status', 'ready');
    expect(mocks.useNetworkFee).toHaveBeenCalledWith(
      'draw',
      { lineId: 'line-1', amount: 100 },
      { enabled: true },
    );
  });

  it('shows a loading state while estimating', () => {
    mocks.useNetworkFee.mockReturnValue({ status: 'loading' });

    render(<NetworkFeeDisplay method="repay" lineId="line-1" amount={10} testId="fee" />);

    expect(screen.getByTestId('fee')).toHaveTextContent('Estimating…');
  });

  it('shows a fallback when the estimate is unavailable', () => {
    mocks.useNetworkFee.mockReturnValue({ status: 'unavailable', error: 'rpc down' });

    render(<NetworkFeeDisplay method="repay" lineId="line-1" amount={10} testId="fee" />);

    expect(screen.getByTestId('fee')).toHaveTextContent('Estimate unavailable');
  });

  it('shows the fallback when estimation is disabled', () => {
    mocks.useNetworkFee.mockReturnValue({ status: 'idle' });

    render(
      <NetworkFeeDisplay method="draw" lineId="line-1" amount={10} enabled={false} testId="fee" />,
    );

    expect(screen.getByTestId('fee')).toHaveTextContent('Estimate unavailable');
    expect(mocks.useNetworkFee).toHaveBeenCalledWith(
      'draw',
      expect.anything(),
      { enabled: false },
    );
  });

  it('re-estimates when the amount changes', () => {
    mocks.useNetworkFee.mockReturnValue({
      status: 'ready',
      estimate: { totalStroops: 100 },
    });

    const { rerender } = render(
      <NetworkFeeDisplay method="draw" lineId="line-1" amount={100} testId="fee" />,
    );
    rerender(
      <NetworkFeeDisplay method="draw" lineId="line-1" amount={250} testId="fee" />,
    );

    expect(mocks.useNetworkFee).toHaveBeenLastCalledWith(
      'draw',
      { lineId: 'line-1', amount: 250 },
      { enabled: true },
    );
  });

  it('exposes an accessible explanation for the fee', () => {
    mocks.useNetworkFee.mockReturnValue({ status: 'idle' });

    render(<NetworkFeeDisplay method="draw" lineId="line-1" amount={10} />);

    expect(
      screen.getByRole('button', { name: /what is the network fee/i }),
    ).toHaveAttribute('aria-describedby');
  });
});
