import { lazy, Suspense, useRef, useState } from "react";
import type { RefObject } from "react";
import type { CreditLine } from "../../types/creditLine";
import { StatusBadge } from "../StatusBadge";
import { CreditLineRowMenu } from "../CreditLineRowMenu";
import { CreditLineAging } from "../CreditLineAging";
import { NextAccrualChip } from "../NextAccrualChip";
import { LastActivityStamp } from "../LastActivityStamp";
import { RepaymentPlanChart } from "../RepaymentPlanChart";
import { HealthFactorChart, deriveHealthFactor } from "../HealthFactorChart";
import { canTransition, getUnfrozenStatus } from "../../lib/credit-line-status";
import { COLOR, UTIL_COLOR, fmt, fmtDate, getUtilizationLevel, utilizationPct } from "../../utils/tokens";

const AprHistoryChart = lazy(() =>
  import("../AprHistoryChart").then((module) => ({ default: module.AprHistoryChart })),
);

export interface CreditLineCardProps {
  line: CreditLine;
  isSelected: boolean;
  onToggle: () => void;
  onSwapCollateral?: (line: CreditLine, triggerRef: RefObject<HTMLButtonElement | null>) => void;
  onRepay?: () => void;
  onSchedule?: (lineId: string) => void;
  onDetails?: (lineId: string, triggerRef: RefObject<HTMLButtonElement | null>) => void;
  onFreeze?: (lineId: string) => void;
  onUnfreeze?: (lineId: string) => void;
}

export function CreditLineCard({
  line, isSelected, onToggle, onRepay, onSchedule, onDetails, onFreeze, onUnfreeze,
}: CreditLineCardProps) {
  const pct = utilizationPct(line.utilized, line.limit);
  const level = getUtilizationLevel(line.utilized, line.limit);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const isDefaulted = line.status === "Defaulted";
  const transitionContext = { statusHistory: line.statusHistory };
  const canFreeze = canTransition(line.status, "Frozen", transitionContext);
  const canUnfreeze = line.status === "Frozen" && canTransition(line.status, getUnfrozenStatus(line), transitionContext);

  return (
    <div className={`cl-card status-${line.status.toLowerCase()}${isDefaulted ? " cl-row--defaulted" : ""} focus-ring`} aria-label={isDefaulted ? `Credit line ${line.id} is defaulted` : undefined} tabIndex={0}>
      <div className="cl-card-header">
        <div className="cl-card-title-row">
          <label className="cl-row-select">
            <input type="checkbox" checked={isSelected} onChange={onToggle} aria-label={`Select ${line.name} for comparison`} className="focus-ring" />
            <span>Compare</span>
          </label>
          <div><h3 className="cl-name">{line.name}</h3><p className="cl-id">{line.id}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={line.status} />
          <CreditLineAging line={line} />
          <CreditLineRowMenu lineId={line.id} lineName={line.name} frozen={line.status === "Frozen"} triggerRef={menuTriggerRef} onRepay={onRepay} onFreeze={canFreeze ? onFreeze : undefined} onUnfreeze={canUnfreeze ? onUnfreeze : undefined} onSchedule={onSchedule} onDetails={onDetails ? (id) => onDetails(id, menuTriggerRef) : undefined} />
        </div>
      </div>
      <div className="cl-card-body">
        <div className="cl-metrics" role="group" aria-label="Credit line metrics">
          <div className="cl-metric"><span className="cl-metric-label">Limit</span><span className="cl-metric-value tabular-nums amount cl-amount" style={{ color: COLOR.accent }}>{fmt(line.limit)}</span></div>
          <div className="cl-metric"><span className="cl-metric-label">Utilized</span><span className="cl-metric-value tabular-nums amount cl-amount" style={{ color: UTIL_COLOR[level] }}>{fmt(line.utilized)}</span></div>
          <div className="cl-metric"><span className="cl-metric-label">Available</span><span className="cl-metric-value tabular-nums amount cl-amount" style={{ color: COLOR.success }}>{fmt(line.limit - line.utilized)}</span></div>
        </div>
        <div className="cl-util-bar">
          <div className="cl-util-header"><span>Utilization</span><span className="tabular-nums amount cl-amount" style={{ color: UTIL_COLOR[level] }}>{pct}%</span></div>
          <div className="cl-util-track"><div className="cl-util-fill" style={{ width: `${pct}%`, background: UTIL_COLOR[level] }} /></div>
        </div>
        <div className="cl-details" role="group" aria-label="Credit line details">
          <div className="cl-detail"><span className="label">APR</span><span className="value tabular-nums amount cl-amount">{line.apr}%</span></div>
          <div className="cl-detail"><span className="label">Risk Score</span><span className="value tabular-nums amount cl-amount">{line.riskScore}</span></div>
          <div className="cl-detail"><span className="label">Opened</span><span className="value">{fmtDate(line.openedAt)}</span></div>
        </div>
        {line.nextInterestAccrualDate && <div className="cl-accrual"><NextAccrualChip target={line.nextInterestAccrualDate} /></div>}
        {(() => { const hf = deriveHealthFactor(line.limit, line.utilized); return <HealthFactorChart lineName={line.name} current={hf} data={line.healthHistory ?? []} />; })()}
        <div className="cl-last-activity"><LastActivityStamp timestamp={line.lastActivityAt ?? line.updatedAt} /></div>
      </div>
      <div className="cl-card-detail"><RepaymentPlanChart line={line} /></div>
      <div className="cl-card-expand-row">
        <button type="button" className="cl-expand-btn focus-ring" aria-expanded={isExpanded} aria-controls={`cl-expanded-${line.id}`} onClick={() => setIsExpanded((previous) => !previous)}>
          {isExpanded ? "Hide APR history" : "Show APR history"}
        </button>
      </div>
      {isExpanded && (
        <div id={`cl-expanded-${line.id}`} className="cl-card-expanded">
          {line.aprHistory && line.aprHistory.length > 0 && <div className="cl-apr-history"><Suspense fallback={null}><AprHistoryChart history={line.aprHistory} lineId={line.id} /></Suspense></div>}
        </div>
      )}
    </div>
  );
}
