import { useMemo, useState } from 'react';
import { COLOR } from '../utils/tokens';
import {
  Axis,
  ChartDataTable,
  ChartFrame,
  ChartTooltip,
  ChartTooltipPoints,
  buildStackedAreaPath,
  createLinearScale,
  useChartPreferences,
  useChartTooltip,
} from './charts';
import type { AxisTick, ChartTooltipPoint } from './charts';
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
const CHART_HEIGHT = 160;
const CHART_WIDTH = 100;
const TABLE_COLUMNS = [
  { header: 'Week' },
  { header: 'Principal' },
  { header: 'Interest' },
  { header: 'Total' },
] as const;

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

export function RepaymentPlanChart({ line }: RepaymentPlanChartProps) {
  const available = Math.max(line.limit - line.utilized, 0);
  const [selectedPercent, setSelectedPercent] = useState(25);
  const { forcedColors: supportsForcedColors, prefersReducedMotion } =
    useChartPreferences();

  const drawAmount = useMemo(() => {
    const percentage = Math.max(selectedPercent, 0);
    return Math.round((available * percentage) / 100);
  }, [available, selectedPercent]);

  const projection = useMemo(
    () => buildProjection(drawAmount, line.apr),
    [drawAmount, line.apr],
  );

  const maxTotal = useMemo(() => {
    const maxPoint = Math.max(...projection.map((point) => point.total), 1);
    return maxPoint * 1.15;
  }, [projection]);

  const xScale = useMemo(
    () => createLinearScale([0, Math.max(projection.length - 1, 1)], [0, CHART_WIDTH]),
    [projection.length],
  );

  const yScale = useMemo(
    () => createLinearScale([0, maxTotal], [CHART_HEIGHT, 0]),
    [maxTotal],
  );

  const { principalPath, interestPath, tooltipPoints, xTicks } = useMemo(() => {
    const baseline = projection.map((_, index) => ({
      x: xScale(index),
      y: yScale(0),
    }));
    const principalTop = projection.map((point, index) => ({
      x: xScale(index),
      y: yScale(point.principal),
    }));
    const interestTop = projection.map((point, index) => ({
      x: xScale(index),
      y: yScale(point.principal + point.interest),
    }));

    const tips: ChartTooltipPoint[] = projection.map((point, index) => ({
      key: `week-${point.week}`,
      x: xScale(index),
      y: yScale(point.principal + point.interest),
      label: `Week ${point.week}`,
      value: `${formatCurrency(point.total)} (${formatCurrency(point.principal)} principal, ${formatCurrency(point.interest)} interest)`,
    }));

    const ticks: AxisTick[] = projection.map((point, index) => ({
      value: index,
      label: `W${point.week}`,
    }));

    return {
      principalPath: buildStackedAreaPath(principalTop, baseline),
      interestPath: buildStackedAreaPath(interestTop, principalTop),
      tooltipPoints: tips,
      xTicks: ticks,
    };
  }, [projection, xScale, yScale]);

  const { activeIndex, setActiveIndex, activePoint } =
    useChartTooltip(tooltipPoints);

  const totalProjectedRepayment = projection.reduce(
    (sum, point) => sum + point.total,
    0,
  );

  const tableRows = useMemo(
    () =>
      projection.map((point) => ({
        key: String(point.week),
        cells: [
          String(point.week),
          formatCurrency(point.principal),
          formatCurrency(point.interest),
          formatCurrency(point.total),
        ],
      })),
    [projection],
  );

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
        <div className="repayment-plan__summary" aria-live="polite">
          <span>Estimated repayment over 12 weeks</span>
          <strong>{formatCurrency(totalProjectedRepayment)}</strong>
        </div>
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
                <span
                  className="repayment-plan__legend-swatch"
                  style={{ background: supportsForcedColors ? 'transparent' : item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="chart-frame-wrapper">
            <ChartFrame
              width={CHART_WIDTH}
              height={CHART_HEIGHT + 24}
              title="Repayment plan by week"
              ariaLabel="Repayment plan by week"
              className={`repayment-plan__chart${prefersReducedMotion ? ' is-reduced-motion' : ''}`}
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

              <Axis
                orientation="bottom"
                scale={xScale}
                ticks={xTicks}
                position={CHART_HEIGHT}
                labelOffset={16}
                lineClassName="repayment-plan__axis"
                labelClassName="repayment-plan__axis-label"
              />

              <path
                d={principalPath}
                fill={supportsForcedColors ? 'url(#principal-hatch)' : COLOR.success}
                className="repayment-plan__area repayment-plan__area--principal"
              />
              <path
                d={interestPath}
                fill={supportsForcedColors ? 'url(#interest-hatch)' : COLOR.warning}
                className="repayment-plan__area repayment-plan__area--interest"
              />

              {projection.map((point, index) => {
                const x = xScale(index);
                const principalTop = yScale(point.principal);
                const interestTop = yScale(point.principal + point.interest);
                return (
                  <g key={point.week} aria-hidden="true">
                    <line x1={x} y1={CHART_HEIGHT} x2={x} y2={interestTop} className="repayment-plan__grid-line" />
                    <circle cx={x} cy={principalTop} r="1.6" fill={COLOR.success} />
                    <circle cx={x} cy={interestTop} r="1.6" fill={COLOR.warning} />
                  </g>
                );
              })}

              <ChartTooltipPoints
                points={tooltipPoints}
                activeIndex={activeIndex}
                onActiveChange={setActiveIndex}
                hitRadius={4}
                ringRadius={2.5}
              />
            </ChartFrame>
            <ChartTooltip point={activePoint} />
          </div>
        </div>

        <div className="repayment-plan__table-card">
          <h5>Projected breakdown</h5>
          <ChartDataTable
            ariaLabel="Projected repayment breakdown by week"
            caption="Weekly principal and interest projections for the selected draw amount."
            captionClassName="sr-only"
            columns={TABLE_COLUMNS}
            rows={tableRows}
            visuallyHidden={false}
            firstCellAsRowHeader
          />
        </div>
      </div>
    </section>
  );
}
