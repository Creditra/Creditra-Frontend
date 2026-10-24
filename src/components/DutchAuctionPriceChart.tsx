import type { DutchAuction } from '../types/dutchAuction';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { getAuctionProgress, priceAtProgress } from '../utils/dutchAuction';
import './DutchAuctionPriceChart.css';

/**
 * View box of the chart. The SVG is scaled by the browser (`width: 100%`),
 * so the drawing is resolution independent and works down to 320px.
 */
const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 160;

const PAD_LEFT = 48;
const PAD_RIGHT = 14;
const PAD_TOP = 20;
const PAD_BOTTOM = 30;

const PLOT_LEFT = PAD_LEFT;
const PLOT_RIGHT = VIEWBOX_WIDTH - PAD_RIGHT;
const PLOT_TOP = PAD_TOP;
const PLOT_BOTTOM = VIEWBOX_HEIGHT - PAD_BOTTOM;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

/** Fractions of the auction window that are reported in the text alternative. */
const SAMPLE_POINTS = [0, 0.25, 0.5, 0.75, 1] as const;

const SAMPLE_LABELS: Record<number, string> = {
  0: '0% — start',
  0.25: '25%',
  0.5: '50%',
  0.75: '75%',
  1: '100% — end',
};

/**
 * Plain (currency-less) number formatting for the chart.
 *
 * The currency formatted price is rendered by the page itself; the chart and
 * its text alternative use plain numbers so a screen reader (or a test) sees
 * one price per place instead of the same string repeated across the page.
 */
const plainNumber = (value: number, maximumFractionDigits = 2) =>
  value.toLocaleString('en-US', { maximumFractionDigits });

export interface DutchAuctionPriceChartProps {
  /** Auction whose decay curve is drawn. */
  auction: DutchAuction;
  /** Timestamp the "now" marker is placed at. Defaults to the current time. */
  now?: number;
  className?: string;
}

/**
 * Accessible price-decay chart for a Dutch auction.
 *
 * - Hand written SVG, no charting dependency. The line is drawn from the
 *   start price down to the floor price across the auction window, with a
 *   marker showing where "now" sits on the curve.
 * - The drawing itself is `aria-hidden`; the text alternative is a visually
 *   hidden table listing the price at 0%, 25%, 50%, 75% and 100% of the
 *   window, so the data is available to screen reader users.
 * - No fixed pixel width — the SVG scales with its container via `viewBox`.
 * - The draw-in animation is skipped when the user prefers reduced motion
 *   (the animation class is not applied at all in that case).
 */
export function DutchAuctionPriceChart({ auction, now, className }: DutchAuctionPriceChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const timestamp = now ?? Date.now();

  const high = Math.max(auction.startPrice, auction.floorPrice);
  const low = Math.min(auction.startPrice, auction.floorPrice);
  const range = high - low || 1;

  const xFor = (progress: number) => PLOT_LEFT + progress * PLOT_WIDTH;
  const yFor = (price: number) => PLOT_BOTTOM - ((price - low) / range) * PLOT_HEIGHT;

  const samples = SAMPLE_POINTS.map((progress) => {
    const price = priceAtProgress(auction, progress);
    return {
      progress,
      label: SAMPLE_LABELS[progress],
      price,
      x: xFor(progress),
      y: yFor(price),
    };
  });

  const points = samples.map((sample) => `${sample.x.toFixed(2)},${sample.y.toFixed(2)}`).join(' ');

  const progress = getAuctionProgress(auction, timestamp);
  const currentPrice = priceAtProgress(auction, progress);
  const markerX = xFor(progress);
  const markerY = yFor(currentPrice);
  const markerLabelX = Math.min(Math.max(markerX, PLOT_LEFT + 14), PLOT_RIGHT - 14);

  const lineClassName = [
    'dutch-auction-chart__line',
    prefersReducedMotion ? '' : 'dutch-auction-chart__line--animated',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['dutch-auction-chart', className].filter(Boolean).join(' ')}>
      <svg
        className="dutch-auction-chart__svg"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <line
          className="dutch-auction-chart__axis"
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={PLOT_RIGHT}
          y2={PLOT_BOTTOM}
        />
        <line
          className="dutch-auction-chart__axis"
          x1={PLOT_LEFT}
          y1={PLOT_TOP}
          x2={PLOT_LEFT}
          y2={PLOT_BOTTOM}
        />

        <text className="dutch-auction-chart__label" x={PLOT_LEFT - 6} y={PLOT_TOP - 8} textAnchor="end">
          USD
        </text>
        <text className="dutch-auction-chart__label" x={PLOT_LEFT - 6} y={PLOT_TOP + 4} textAnchor="end">
          {plainNumber(high, 0)}
        </text>
        <text className="dutch-auction-chart__label" x={PLOT_LEFT - 6} y={PLOT_BOTTOM} textAnchor="end">
          {plainNumber(low, 0)}
        </text>
        <text className="dutch-auction-chart__label" x={PLOT_LEFT} y={VIEWBOX_HEIGHT - 10} textAnchor="start">
          Auction start
        </text>
        <text className="dutch-auction-chart__label" x={PLOT_RIGHT} y={VIEWBOX_HEIGHT - 10} textAnchor="end">
          Auction end
        </text>

        <polyline className={lineClassName} fill="none" points={points} />

        <line
          className="dutch-auction-chart__now-line"
          x1={markerX}
          y1={PLOT_TOP}
          x2={markerX}
          y2={PLOT_BOTTOM}
        />
        <circle className="dutch-auction-chart__now-dot" cx={markerX} cy={markerY} r={4} />
        <text className="dutch-auction-chart__now-label" x={markerLabelX} y={PLOT_TOP - 6} textAnchor="middle">
          Now
        </text>
      </svg>

      {/*
        Text alternative for the drawing above. Visually hidden with the
        project-wide `.sr-only` utility, but fully exposed to assistive
        technology: one row per quarter of the auction window.
      */}
      <table className="sr-only" aria-label={`Price schedule for ${auction.nft.name}`}>
        <caption>
          Price in USD at 0%, 25%, 50%, 75% and 100% of the auction window
        </caption>
        <tbody>
          {samples.map((sample) => (
            <tr key={sample.progress}>
              <th scope="row">{sample.label}</th>
              <td>{plainNumber(sample.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
