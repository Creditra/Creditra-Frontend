import { useMemo } from 'react';
import {
  ChartDataTable,
  ChartFrame,
  ChartTooltip,
  ChartTooltipPoints,
  buildPolylinePoints,
  createLinearScale,
  useChartTooltip,
} from './charts';
import type { ChartTooltipPoint } from './charts';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
}

const TABLE_COLUMNS = [{ header: 'Day' }, { header: 'Value' }] as const;

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = 'var(--accent, #4F46E5)',
  strokeWidth = 2,
  className = '',
  ariaLabel = '30-day risk trend',
}: SparklineProps) {
  const { pointsAttr, tooltipPoints, min, max } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        pointsAttr: '',
        tooltipPoints: [] as ChartTooltipPoint[],
        min: 0,
        max: 0,
      };
    }

    const minV = Math.min(...data);
    const maxV = Math.max(...data);
    const padding = strokeWidth;

    const xScale = createLinearScale(
      [0, Math.max(data.length - 1, 1)],
      [padding, width - padding],
    );
    const yScale = createLinearScale(
      [minV, maxV],
      [height - padding, padding],
    );

    const coords = data.map((d, i) => ({
      x: data.length === 1 ? width / 2 : xScale(i),
      y: yScale(d),
      value: d,
      day: i + 1,
    }));

    return {
      pointsAttr: buildPolylinePoints(coords),
      tooltipPoints: coords.map((c) => ({
        key: `day-${c.day}`,
        x: c.x,
        y: c.y,
        label: `Day ${c.day}`,
        value: String(c.value),
      })),
      min: minV,
      max: maxV,
    };
  }, [data, width, height, strokeWidth]);

  const { activeIndex, setActiveIndex, activePoint } =
    useChartTooltip(tooltipPoints);

  const tableRows = useMemo(
    () =>
      (data ?? []).map((d, i) => ({
        key: String(i),
        cells: [`Day ${i + 1}`, String(d)],
      })),
    [data],
  );

  if (!data || data.length === 0) return null;

  const summaryTitle = `${ariaLabel}: ${data.length} points, range ${min} to ${max}`;

  return (
    <div
      className={`sparkline-container ${className}`}
      style={{ display: 'inline-flex', flexDirection: 'column', gap: '4px', position: 'relative' }}
    >
      <ChartFrame
        width={width}
        height={height}
        explicitDimensions
        title={summaryTitle}
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsAttr}
        />
        <ChartTooltipPoints
          points={tooltipPoints}
          activeIndex={activeIndex}
          onActiveChange={setActiveIndex}
          hitRadius={4}
          ringRadius={3}
        />
      </ChartFrame>
      <ChartTooltip point={activePoint} />

      {/* SR table fallback */}
      <ChartDataTable
        ariaLabel={ariaLabel}
        columns={TABLE_COLUMNS}
        rows={tableRows}
      />
    </div>
  );
}
