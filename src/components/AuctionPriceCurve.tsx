import React, { useMemo } from 'react';
import {
  fromStroops,
  priceAt,
  validateSchedule,
  type AuctionScheduleInput,
} from '../lib/dutch-auction-pricing';
import { fmt } from '../utils/tokens';
import './AuctionPriceCurve.css';

export interface AuctionPriceCurveProps {
  auction: AuctionScheduleInput;
  nowMs: number;
}

const SAMPLE_COUNT = 40;
export const CURVE_VIEWBOX_WIDTH = 240;
export const CURVE_VIEWBOX_HEIGHT = 56;
export const CURVE_PADDING_X = 6;
export const CURVE_PADDING_Y = 6;

const DRAW_WIDTH = CURVE_VIEWBOX_WIDTH - CURVE_PADDING_X * 2;
const DRAW_HEIGHT = CURVE_VIEWBOX_HEIGHT - CURVE_PADDING_Y * 2;

function priceToY(price: number, startPrice: number, floorPrice: number): number {
  const range = startPrice - floorPrice;
  if (range <= 0) {
    return CURVE_PADDING_Y + DRAW_HEIGHT / 2;
  }
  return CURVE_PADDING_Y + ((startPrice - price) / range) * DRAW_HEIGHT;
}

export const AuctionPriceCurve: React.FC<AuctionPriceCurveProps> = ({ auction, nowMs }) => {
  const validation = validateSchedule(auction);

  const curveData = useMemo(() => {
    if (!validation.ok) return null;

    const startMs = new Date(auction.startTime).getTime();
    const endMs = new Date(auction.endTime).getTime();
    const durationMs = endMs - startMs;

    const startPrice = fromStroops(priceAt(auction, startMs));
    const floorPrice = fromStroops(priceAt(auction, endMs));

    const points: string[] = [];
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const ratio = i / (SAMPLE_COUNT - 1);
      const sampleMs = Math.round(startMs + ratio * durationMs);
      const samplePrice = fromStroops(priceAt(auction, sampleMs));
      const x = CURVE_PADDING_X + ratio * DRAW_WIDTH;
      const y = priceToY(samplePrice, startPrice, floorPrice);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    return {
      startMs,
      endMs,
      durationMs,
      startPrice,
      floorPrice,
      polylinePoints: points.join(' '),
    };
  }, [auction, validation.ok]);

  if (!curveData || !Number.isFinite(nowMs)) {
    return null;
  }

  const clampedNowMs = Math.min(Math.max(Math.round(nowMs), curveData.startMs), curveData.endMs);
  const currentPrice = fromStroops(priceAt(auction, clampedNowMs));
  const progress = (clampedNowMs - curveData.startMs) / curveData.durationMs;

  const markerX = CURVE_PADDING_X + progress * DRAW_WIDTH;
  const markerY = priceToY(currentPrice, curveData.startPrice, curveData.floorPrice);

  const summary = `Price falls from ${fmt(curveData.startPrice)} to ${fmt(curveData.floorPrice)}; currently ${fmt(currentPrice)}`;

  return (
    <div className="auction-price-curve" data-testid="auction-price-curve">
      <svg
        className="auction-price-curve__svg"
        viewBox={`0 0 ${CURVE_VIEWBOX_WIDTH} ${CURVE_VIEWBOX_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={summary}
        focusable="false"
      >
        <polyline
          className="auction-price-curve__line"
          points={curveData.polylinePoints}
        />
        <circle
          className="auction-price-curve__marker"
          data-testid="auction-price-curve-marker"
          cx={markerX.toFixed(2)}
          cy={markerY.toFixed(2)}
          r={4}
          aria-hidden="true"
        />
      </svg>
      <div className="auction-price-curve__labels" aria-hidden="true">
        <span className="auction-price-curve__label">Start {fmt(curveData.startPrice)}</span>
        <span className="auction-price-curve__label">Floor {fmt(curveData.floorPrice)}</span>
      </div>
    </div>
  );
};
