import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AuctionPriceCurve,
  CURVE_PADDING_X,
  CURVE_PADDING_Y,
  CURVE_VIEWBOX_HEIGHT,
  CURVE_VIEWBOX_WIDTH,
} from './AuctionPriceCurve';
import { fromStroops, priceAt, type AuctionScheduleInput } from '../lib/dutch-auction-pricing';

const START_MS = Date.parse('2026-06-01T10:00:00.000Z');
const END_MS = Date.parse('2026-06-01T12:00:00.000Z');
const MID_MS = START_MS + (END_MS - START_MS) / 2;

const validAuction: AuctionScheduleInput = {
  startTime: new Date(START_MS).toISOString(),
  endTime: new Date(END_MS).toISOString(),
  startPrice: 1000,
  floorPrice: 200,
};

const DRAW_WIDTH = CURVE_VIEWBOX_WIDTH - CURVE_PADDING_X * 2;
const DRAW_HEIGHT = CURVE_VIEWBOX_HEIGHT - CURVE_PADDING_Y * 2;

function expectedY(auction: AuctionScheduleInput, nowMs: number): number {
  const current = fromStroops(priceAt(auction, nowMs));
  const range = auction.startPrice - auction.floorPrice;
  if (range <= 0) return CURVE_PADDING_Y + DRAW_HEIGHT / 2;
  return CURVE_PADDING_Y + ((auction.startPrice - current) / range) * DRAW_HEIGHT;
}

describe('AuctionPriceCurve', () => {
  it('positions the marker at the start of the curve at startTime', () => {
    render(<AuctionPriceCurve auction={validAuction} nowMs={START_MS} />);

    const marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(CURVE_PADDING_X, 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(expectedY(validAuction, START_MS), 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_PADDING_Y, 2);

    const svg = screen.getByRole('img', {
      name: 'Price falls from $1,000 to $200; currently $1,000',
    });
    expect(svg).toBeInTheDocument();
  });

  it('positions the marker at the midpoint of the curve at midTime matching priceAt', () => {
    render(<AuctionPriceCurve auction={validAuction} nowMs={MID_MS} />);

    const marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(CURVE_PADDING_X + DRAW_WIDTH / 2, 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(expectedY(validAuction, MID_MS), 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_PADDING_Y + DRAW_HEIGHT / 2, 2);

    const svg = screen.getByRole('img', {
      name: 'Price falls from $1,000 to $200; currently $600',
    });
    expect(svg).toBeInTheDocument();
  });

  it('positions the marker at the end of the curve at endTime', () => {
    render(<AuctionPriceCurve auction={validAuction} nowMs={END_MS} />);

    const marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(CURVE_VIEWBOX_WIDTH - CURVE_PADDING_X, 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(expectedY(validAuction, END_MS), 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_VIEWBOX_HEIGHT - CURVE_PADDING_Y, 2);

    const svg = screen.getByRole('img', {
      name: 'Price falls from $1,000 to $200; currently $200',
    });
    expect(svg).toBeInTheDocument();
  });

  it('clamps the marker to the ends before startTime and after endTime', () => {
    const { rerender } = render(
      <AuctionPriceCurve auction={validAuction} nowMs={START_MS - 60_000} />,
    );

    let marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(CURVE_PADDING_X, 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_PADDING_Y, 2);

    rerender(<AuctionPriceCurve auction={validAuction} nowMs={END_MS + 60_000} />);
    marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number(marker.getAttribute('cx'))).toBeCloseTo(CURVE_VIEWBOX_WIDTH - CURVE_PADDING_X, 2);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_VIEWBOX_HEIGHT - CURVE_PADDING_Y, 2);
  });

  it('renders a 40-point polyline and start/floor labels', () => {
    const { container } = render(<AuctionPriceCurve auction={validAuction} nowMs={MID_MS} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).not.toBeNull();
    const points = polyline!.getAttribute('points')!.trim().split(/\s+/);
    expect(points).toHaveLength(40);
    expect(container.textContent).toContain('Start $1,000');
    expect(container.textContent).toContain('Floor $200');
  });

  it('renders nothing for invalid schedules', () => {
    const invalidSchedules: AuctionScheduleInput[] = [
      { ...validAuction, startTime: 'not-a-date' },
      { ...validAuction, endTime: validAuction.startTime },
      { ...validAuction, floorPrice: 1200 },
      { ...validAuction, floorPrice: -10 },
    ];

    for (const schedule of invalidSchedules) {
      const { container } = render(<AuctionPriceCurve auction={schedule} nowMs={MID_MS} />);
      expect(container.firstChild).toBeNull();
    }
  });

  it('handles flat schedules where startPrice equals floorPrice without NaN coordinates', () => {
    const flatAuction: AuctionScheduleInput = {
      ...validAuction,
      startPrice: 500,
      floorPrice: 500,
    };
    render(<AuctionPriceCurve auction={flatAuction} nowMs={MID_MS} />);
    const marker = screen.getByTestId('auction-price-curve-marker');
    expect(Number.isNaN(Number(marker.getAttribute('cx')))).toBe(false);
    expect(Number.isNaN(Number(marker.getAttribute('cy')))).toBe(false);
    expect(Number(marker.getAttribute('cy'))).toBeCloseTo(CURVE_PADDING_Y + DRAW_HEIGHT / 2, 2);
  });
});
