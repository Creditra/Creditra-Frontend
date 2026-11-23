import { COLOR } from '@/utils/tokens';
import { KbdHint } from '../KbdHint';

export interface RepaymentLegendProps {
  reducedMotion?: boolean;
}

export function RepaymentLegend({ reducedMotion = false }: RepaymentLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-3 sm:mt-4">
      <div
        className={`flex flex-wrap items-center gap-3 sm:gap-4 text-xs${reducedMotion ? '' : ' rv-legend-animate'}`}
        style={{ color: `var(--muted, ${COLOR.muted})` }}
        aria-hidden="true"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="rv-legend-swatch rv-legend-swatch--principal" data-series="principal" />
          Principal remaining
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="rv-legend-swatch rv-legend-swatch--interest" data-series="interest" />
          Cumulative interest
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <KbdHint keys={['←', '→']} label="Inspect" />
        <KbdHint keys="Esc" label="Clear" />
      </div>
    </div>
  );
}
