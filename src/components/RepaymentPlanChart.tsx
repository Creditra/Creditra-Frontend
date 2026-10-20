import { useEffect, useMemo, useState } from 'react';
import { COLOR } from '../utils/tokens';
import './RepaymentPlanChart.css';
import type { CreditLine } from '../types/creditLine';

interface RepaymentPlanChartProps {
  line: CreditLine;
}

interface RepaymentPoint {
  week: number;
  principal: number;
  interest: number;
  total: number;
  balance: number;
}

const WEEKS = 12;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildProjection(drawAmount: number, apr: number, horizon: number = WEEKS) {
  const points: RepaymentPoint[] = [];
  let balance = drawAmount;

  for (let week = 1; week <= horizon; week += 1) {
    const remainingWeeks = horizon - week + 1;
    const principalPayment = Math.max(balance / remainingWeeks, 0);
    const interestPayment = balance * (apr / 100 / 52);
    const nextBalance = Math.max(balance - principalPayment, 0);

    points.push({
      week,
      principal: principalPayment,
      interest: interestPayment,
      total: principalPayment + interestPayment,
      balance: nextBalance,
    });

    balance = nextBalance;
  }

  return points;
}

function createAreaPath(
  points: RepaymentPoint[],
  chartHeight: number,
  maxTotal: number,
  valueAccessor: (point: RepaymentPoint) => number,
  baseAccessor: (point: RepaymentPoint) => number = () => 0,
) {
  const width = 100;
  const step = width / Math.max(points.length - 1, 1);

  const coordinates = points.map((point, index) => {
    const x = index * step;
    const baseline = baseAccessor(point);
    const value = valueAccessor(point);
    const y = chartHeight - ((baseline + value) / maxTotal) * chartHeight;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  const baselineCoordinates = [...points].reverse().map((point, reverseIndex) => {
    const index = points.length - 1 - reverseIndex;
    const x = (index - 1) * step;
    const baseline = baseAccessor(point);
    const y = chartHeight - (baseline / maxTotal) * chartHeight;
    return `L ${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  return `${coordinates.join(' ')} ${baselineCoordinates.join(' ')} Z`;
}

export function RepaymentPlanChart({ line }: RepaymentPlanChartProps) {
  const available = Math.max(line.limit - line.utilized, 0);
  const [selectedPercent, setSelectedPercent] = useState(25);
  const [supportsForcedColors, setSupportsForcedColors] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const forcedColorsQuery = window.matchMedia('(forced-colors: active)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const updateMediaQueries = () => {
      setSupportsForcedColors(forcedColorsQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };

    updateMediaQueries();
    forcedColorsQuery.addEventListener?.('change', updateMediaQueries);
    reducedMotionQuery.addEventListener?.('change', updateMediaQueries);

    return () => {
      forcedColorsQuery.removeEventListener?.('change', updateMediaQueries);
      reducedMotionQuery.removeEventListener?.('change', updateMediaQueries);
    };
  }, []);

  const drawAmount = useMemo(() => {
    const percentage = Math.max(selectedPercent, 0);
    return Math.round((available * percentage) / 100);
  }, [available, selectedPercent]);

  const projection = useMemo(() => buildProjection(drawAmount, line.apr), [drawAmount, line.apr]);

  const maxTotal = useMemo(() => {
    const maxPoint = Math.max(...projection.map((point) => point.total), 1);
    return maxPoint * 1.15;
  }, [projection]);

  const chartHeight = 160;
  const chartWidth = 100;
  const step = chartWidth / Math.max(projection.length - 1, 1);

  const principalPath = createAreaPath(projection, chartHeight, maxTotal, (point) => point.principal);
  const interestPath = createAreaPath(
    projection,
    chartHeight,
    maxTotal,
    (point) => point.interest,
    (point) => point.principal,
  );

  const totalProjectedRepayment = projection.reduce((sum, point) => sum + point.total, 0);

  const legendItems = [
    { label: 'Principal', color: COLOR.success, pattern: 'principal-hatch' },
    { label: 'Interest', color: COLOR.warning, pattern: 'interest-hatch' },
  ];

  return (
    <section className="repayment-plan" aria-labelledby="repayment-plan-heading">
      <div className="repayment-plan__header">
        <div>
          <h4 id="repayment-plan-heading">Projected repayment plan</h4>
          <p>Weekly buckets for the selected draw amount over 12 weeks.</p>
        </div>
        <span className="repayment-plan__summary" aria-live="polite">
          <span>Estimated repayment over 12 weeks {formatCurrency(totalProjectedRepayment)}</span>
        </span>
      </div>

      <div className="repayment-plan__controls" role="group" aria-label="Draw amount presets">
        {[25, 50, 75, 100].map((percent) => (
          <button
            key={percent}
            type="button"
            className={`repayment-plan__preset${selectedPercent === percent ? ' is-active' : ''}`}
            onClick={() => setSelectedPercent(percent)}
            aria-pressed={selectedPercent === percent}
          >
            {percent}%
          </button>
        ))}
      </div>

      <div className="repayment-plan__body">
        <div className="repayment-plan__chart-card">
          <div className="repayment-plan__legend" aria-label="Chart legend">
            {legendItems.map((item) => (
              <div key={item.label} className="repayment-plan__legend-item">
                <span className="repayment-plan__legend-swatch" style={{ background: supportsForcedColors ? 'transparent' : item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <svg
            className={`repayment-plan__chart${prefersReducedMotion ? ' is-reduced-motion' : ''}`}
            viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}
            role="img"
            aria-label="Repayment plan by week"
          >
            <defs>
              <pattern id="principal-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={supportsForcedColors ? 'CanvasText' : COLOR.success} strokeWidth="1.25" />
              </pattern>
              <pattern id="interest-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
                <rect width="6" height="6" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={supportsForcedColors ? 'CanvasText' : COLOR.warning} strokeWidth="1.25" />
              </pattern>
            </defs>

            <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} className="repayment-plan__axis" />

            <path d={principalPath} fill={supportsForcedColors ? 'url(#principal-hatch)' : COLOR.success} className="repayment-plan__area repayment-plan__area--principal" />
            <path d={interestPath} fill={supportsForcedColors ? 'url(#interest-hatch)' : COLOR.warning} className="repayment-plan__area repayment-plan__area--interest" />

            {projection.map((point, index) => {
              const x = index * step;
              const principalTop = chartHeight - (point.principal / maxTotal) * chartHeight;
              const interestTop = chartHeight - ((point.principal + point.interest) / maxTotal) * chartHeight;
              return (
                <g key={point.week}>
                  <line x1={x} y1={chartHeight} x2={x} y2={interestTop} className="repayment-plan__grid-line" />
                  <circle cx={x} cy={principalTop} r="1.6" fill={COLOR.success} />
                  <circle cx={x} cy={interestTop} r="1.6" fill={COLOR.warning} />
                </g>
              );
            })}

            {projection.map((point, index) => (
              <text key={`${point.week}-label`} x={index * step} y={chartHeight + 16} textAnchor="middle" className="repayment-plan__axis-label">
                W{point.week}
              </text>
            ))}
          </svg>
        </div>

        <div className="repayment-plan__table-card">
          <h5>Projected breakdown</h5>
          <table aria-label="Projected repayment breakdown by week">
            <caption className="sr-only">Weekly principal and interest projections for the selected draw amount.</caption>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Principal</th>
                <th scope="col">Interest</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {projection.map((point) => (
                <tr key={point.week}>
                  <th scope="row">{point.week}</th>
                  <td>{formatCurrency(point.principal)}</td>
                  <td>{formatCurrency(point.interest)}</td>
                  <td>{formatCurrency(point.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
