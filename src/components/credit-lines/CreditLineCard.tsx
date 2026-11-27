import React, { Suspense, useRef, useState } from "react";
import { Skeleton } from "../Skeleton";
import { StatusBadge } from "../StatusBadge";
import { CreditLineRowMenu } from "../CreditLineRowMenu";
import { CreditLineAging } from "../CreditLineAging";
import { HealthFactorChart, deriveHealthFactor } from "../HealthFactorChart";
import { NextAccrualChip } from "../NextAccrualChip";
import { LastActivityStamp } from "../LastActivityStamp";
import { RepaymentPlanChart } from "../RepaymentPlanChart";
import { Amount } from "../Amount";
import { AprHistoryChart } from "../AprHistoryChart";
import { canTransition, getUnfrozenStatus } from "../../lib/credit-line-status";
import type { CreditLine } from "../../types/creditLine";
import {
  COLOR,
  UTIL_COLOR,
  fmt,
  fmtDate,
  getUtilizationDisplay,
} from "../../utils/tokens";

export interface CreditLineCardProps {
  line: CreditLine;
  isSelected?: boolean;
  onToggle?: (lineId: string) => void;
  onSwapCollateral?: (
    line: CreditLine,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void;
  onAdjustCollateral?: (
    line: CreditLine,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void;
  onRepay?: () => void;
  onSchedule?: (lineId: string) => void;
  onDetails?: (
    lineId: string,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void;
  onFreeze?: (lineId: string) => void;
  onUnfreeze?: (lineId: string) => void;
  limitIncreaseDisabledReasons?: string[];
  onRequestLimitIncrease?: (
    line: CreditLine,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void;
  increasePending?: boolean;
}

function areCreditLineCardPropsEqual(prev: CreditLineCardProps, next: CreditLineCardProps) {
  return (
    prev.isSelected === next.isSelected &&
    prev.onToggle === next.onToggle &&
    prev.onSwapCollateral === next.onSwapCollateral &&
    prev.onAdjustCollateral === next.onAdjustCollateral &&
    prev.onRepay === next.onRepay &&
    prev.onSchedule === next.onSchedule &&
    prev.onDetails === next.onDetails &&
    prev.onFreeze === next.onFreeze &&
    prev.onUnfreeze === next.onUnfreeze &&
    prev.increasePending === next.increasePending &&
    JSON.stringify(prev.line) === JSON.stringify(next.line)
  );
}

export const CreditLineCard = React.memo(function CreditLineCardComponent({
  line,
  isSelected = false,
  onToggle = () => undefined,
  onAdjustCollateral,
  onRepay,
  onSchedule,
  onDetails,
  onFreeze,
  onUnfreeze,
  limitIncreaseDisabledReasons = [],
  onRequestLimitIncrease = () => undefined,
  increasePending = false,
}: CreditLineCardProps) {
  const { pct, barPct, level, overLimitBy, available } = getUtilizationDisplay(line.utilized, line.limit);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const isDefaulted = line.status === "Defaulted";
  const transitionContext = { statusHistory: line.statusHistory };
  const canFreeze = canTransition(line.status, "Frozen", transitionContext);
  const canUnfreeze = line.status === "Frozen" && canTransition(line.status, getUnfrozenStatus(line), transitionContext);

  return (
    <div
      className={`cl-card status-${line.status.toLowerCase()}${isDefaulted ? " cl-row--defaulted" : ""} focus-ring`}
      aria-label={isDefaulted ? `Credit line ${line.id} is defaulted` : undefined}
      tabIndex={0}
    >
      <div className="cl-card-header">
        <div className="cl-card-title-row">
          <label className="cl-row-select">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(line.id)}
              aria-label={`Select ${line.name} for comparison`}
              className="focus-ring"
            />
            <span>Compare</span>
          </label>
          <div>
            <h3 className="cl-name">{line.name}</h3>
            <p className="cl-id">{line.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={line.status} />
          {increasePending && <span className="cl-limit-increase-pending">Increase pending</span>}
          <CreditLineAging line={line} />
          <CreditLineRowMenu
            lineId={line.id}
            lineName={line.name}
            frozen={line.status === "Frozen"}
            triggerRef={menuTriggerRef}
            onRepay={onRepay}
            onAdjustCollateral={onAdjustCollateral ? () => onAdjustCollateral(line, menuTriggerRef) : undefined}
            onFreeze={canFreeze ? onFreeze : undefined}
            onUnfreeze={canUnfreeze ? onUnfreeze : undefined}
            onSchedule={onSchedule}
            onDetails={onDetails ? (id) => onDetails(id, menuTriggerRef) : undefined}
            onRequestLimitIncrease={(id) => { if (id === line.id) onRequestLimitIncrease(line, menuTriggerRef); }}
            limitIncreaseDisabledReasons={limitIncreaseDisabledReasons}
          />
        </div>
      </div>

      <div className="cl-card-body">
        <div className="cl-metrics" role="group" aria-label="Credit line metrics">
          <div className="cl-metric">
            <span className="cl-metric-label">Limit</span>
            <span className="cl-metric-value tabular-nums amount cl-amount" style={{ color: COLOR.accent }}>
              <Amount value={line.limit} format={fmt} maskedLabel="Credit limit hidden for privacy" />
            </span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Utilized</span>
            <span className="cl-metric-value tabular-nums amount cl-amount" style={{ color: UTIL_COLOR[level] }}>
              <Amount value={line.utilized} format={fmt} maskedLabel="Utilized amount hidden for privacy" />
            </span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Available</span>
            <span className="cl-metric-value cl-available tabular-nums amount cl-amount" style={{ color: COLOR.success }}>
              <Amount value={available} format={fmt} maskedLabel="Available credit hidden for privacy" />
            </span>
          </div>
        </div>

        <div className="cl-util-bar">
          <div className="cl-util-header">
            <span>Utilization</span>
            <span className="tabular-nums amount cl-amount" style={{ color: UTIL_COLOR[level] }}>{pct}%</span>
          </div>
          {overLimitBy > 0 && <div className="cl-over-limit" role="note">Over limit by {fmt(overLimitBy)}</div>}
          <div
            className="cl-util-track"
            role="meter"
            aria-label={`Utilization for ${line.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={overLimitBy > 0 ? `${pct}% — over limit by ${fmt(overLimitBy)}` : `${pct}%`}
          >
            <div className={`cl-util-fill cl-bar-fill${overLimitBy > 0 ? " cl-bar-fill--over-limit" : ""}`} style={{ width: `${barPct}%`, background: UTIL_COLOR[level] }} />
          </div>
        </div>

        <div className="cl-details" role="group" aria-label="Credit line details">
          <div className="cl-detail"><span className="label">APR</span><span className="value tabular-nums amount cl-amount">{line.apr}%</span></div>
          <div className="cl-detail"><span className="label">Risk Score</span><span className="value tabular-nums amount cl-amount">{line.riskScore}</span></div>
          <div className="cl-detail"><span className="label">Opened</span><span className="value tabular-nums">{fmtDate(line.openedAt)}</span></div>
        </div>

        {line.nextInterestAccrualDate && <div className="cl-accrual"><NextAccrualChip target={line.nextInterestAccrualDate} /></div>}

        {(() => {
          const hf = deriveHealthFactor(line.limit, line.utilized);
          return <HealthFactorChart lineName={line.name} current={hf} data={line.healthHistory ?? []} />;
        })()}

        <div className="cl-last-activity"><LastActivityStamp timestamp={line.lastActivityAt ?? line.updatedAt} /></div>
      </div>

      <div className="cl-card-detail"><RepaymentPlanChart line={line} /></div>

      <div className="cl-card-expand-row">
        <button
          type="button"
          className="cl-expand-btn focus-ring"
          aria-expanded={isExpanded}
          aria-controls={`cl-expanded-${line.id}`}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? "Hide APR history" : "Show APR history"}
        </button>
      </div>

      {isExpanded && (
        <div id={`cl-expanded-${line.id}`} className="cl-card-expanded" role="region" aria-label={`APR history for ${line.name}`}>
          {line.aprHistory && line.aprHistory.length > 0 && (
            <div className="cl-apr-history">
              <Suspense fallback={null}><AprHistoryChart history={line.aprHistory} lineId={line.id} /></Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, areCreditLineCardPropsEqual);

export function CreditLineCardSkeleton() {
  return (
    <div className="cl-card cl-card--skeleton" aria-hidden="true">
      <div className="cl-card-header">
        <div className="cl-card-title-row"><div><Skeleton width="140px" height="18px" /><Skeleton width="90px" height="13px" /></div></div>
        <Skeleton width="70px" height="22px" />
      </div>
      <div className="cl-card-body">
        <div className="cl-metrics">
          {[50, 60, 65].map((width) => (
            <div className="cl-metric" key={width}><Skeleton width={`${width}px`} height="12px" /><Skeleton width="80px" height="18px" /></div>
          ))}
        </div>
        <div className="cl-util-bar"><Skeleton width="100%" height="8px" /></div>
      </div>
    </div>
  );
}

export default CreditLineCard;
