/**
 * CreditLines page — issue #573
 * Applies font-variant-numeric: tabular-nums to all numeric displays
 * (Limit, Utilized, Available, utilization %, APR, Risk Score) via the
 * shared `.tabular-nums` utility class from src/styles/typography.css.
 */
import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { CreditLineRowMenu } from "../components/CreditLineRowMenu";
import { Skeleton } from "../components/Skeleton";
import CompareLinesPanel from "../components/CompareLinesPanel";
import { CollateralSubstitutionModal } from "../components/CollateralSubstitutionModal";
import { NoLines } from "../components/illustrations";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInertBackdrop } from "../hooks/useInertBackdrop";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MOCK_CREDIT_LINES } from "../data/mockData";
import type {
  CreditLineStatus,
  SortField,
  SortDirection,
} from "../types/creditLine";
import type { CollateralAsset } from "../types/collateral";
import {
  HealthFactorChart,
  buildHealthHistory,
  deriveHealthFactor,
} from "../components/HealthFactorChart";
import {
  COLOR,
  UTIL_COLOR,
  fmt,
  fmtDate,
  fmtDateTime,
  getUtilizationLevel,
  utilizationPct,
} from "../utils/tokens";
import { formatCountdown, getCountdownAriaLabel } from "../utils/dates";
import "./CreditLines.css";
import { AccessibleTooltip } from "../components/AccessibleTooltip";
import { KbdHint } from "../components/KbdHint";
import { AgingTag } from "../components/AgingTag";
import { LastActivityStamp } from "../components/LastActivityStamp";
import { RepaymentPlanChart } from "../components/RepaymentPlanChart";
import {
  RepaymentSchedule,
  buildRepaymentScheduleFromLines,
} from "../components/RepaymentSchedule";
import { useReducedMotion } from "../context/ReducedMotionContext";

// ─── Next Accrual Chip ───────────────────────────────────────────────────────

/**
 * Live countdown chip showing time until the next interest accrual.
 * Ticks every minute and pauses when the tab is hidden (Page Visibility API)
 * to avoid unnecessary wakeups.
 *
 * font-variant-numeric: tabular-nums is applied via CreditLines.css on
 * .cl-accrual-chip so the countdown digits don't shift layout as they change.
 */
function NextAccrualChip({ target }: { target: string }) {
  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const tick = () => setNow(new Date());

    const handleVisibility = () => {
      if (document.hidden) {
        if (timerRef.current !== undefined) {
          clearInterval(timerRef.current);
          timerRef.current = undefined;
        }
      } else {
        if (timerRef.current !== undefined) clearInterval(timerRef.current);
        tick();
        timerRef.current = setInterval(tick, 60_000);
      }
    };

    if (!document.hidden) {
      timerRef.current = setInterval(tick, 60_000);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (timerRef.current !== undefined) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const label = formatCountdown(target, now);
  const ariaLabel = getCountdownAriaLabel(target, now);

  return (
    <span className="cl-accrual-chip" aria-label={ariaLabel}>
      {label}
    </span>
  );
}

// ─── Credit Line Card ────────────────────────────────────────────────────────

function CreditLineCard({
  line,
  isSelected,
  onToggle,
  onSwapCollateral,
  onRepay,
  onSchedule,
  onDetails,
  onFreeze,
  onUnfreeze,
}: {
  line: (typeof MOCK_CREDIT_LINES)[0];
  isSelected: boolean;
  onToggle: () => void;
  onSwapCollateral?: (
    line: (typeof MOCK_CREDIT_LINES)[0],
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => void;
  onRepay?: () => void;
  onSchedule?: (lineId: string) => void;
  onDetails?: (lineId: string) => void;
  onFreeze?: (lineId: string) => void;
  onUnfreeze?: (lineId: string) => void;
}) {
  const pct = utilizationPct(line.utilized, line.limit);
  const level = getUtilizationLevel(line.utilized, line.limit);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const swapTriggerRef = useRef<HTMLButtonElement>(null);

  const isDefaulted = line.status === "Defaulted";
  const canFreeze = line.status === "Active" || line.status === "Frozen";

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
              onChange={onToggle}
              aria-label={`Select ${line.name} for comparison`}
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
          {(() => {
            if (line.status === "Defaulted" || line.status === "Suspended") {
              const overdueEntry = line.statusHistory.find(
                (h) => h.status === "Suspended" || h.status === "Defaulted",
              );
              if (overdueEntry) {
                const diffTime = Math.abs(
                  new Date().getTime() - new Date(overdueEntry.date).getTime(),
                );
                const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return <AgingTag daysPastDue={days} />;
              }
            }
            return null;
          })()}
          <CreditLineRowMenu
            lineId={line.id}
            lineName={line.name}
            frozen={line.status === "Frozen"}
            onRepay={onRepay}
            onFreeze={canFreeze ? onFreeze : undefined}
            onUnfreeze={canFreeze ? onUnfreeze : undefined}
            onSchedule={onSchedule}
            onDetails={onDetails}
          />
        </div>
      </div>

      <div className="cl-card-body">
        <div className="cl-metrics" role="group" aria-label="Credit line metrics">
          {/* tabular-nums prevents digit-width wobble as amounts change (issue #573) */}
          <div className="cl-metric">
            <span className="cl-metric-label">Limit</span>
            <span className="cl-metric-value tabular-nums" style={{ color: COLOR.accent }}>
              {fmt(line.limit)}
            </span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Utilized</span>
            <span className="cl-metric-value tabular-nums" style={{ color: UTIL_COLOR[level] }}>
              {fmt(line.utilized)}
            </span>
          </div>
          <div className="cl-metric">
            <span className="cl-metric-label">Available</span>
            <span className="cl-metric-value tabular-nums" style={{ color: COLOR.success }}>
              {fmt(line.limit - line.utilized)}
            </span>
          </div>
        </div>

        <div className="cl-util-bar">
          <div className="cl-util-header">
            <span>Utilization</span>
            {/* tabular-nums keeps the % stable as the value animates (issue #573) */}
            <span className="tabular-nums" style={{ color: UTIL_COLOR[level] }}>
              {pct}%
            </span>
          </div>
          <div className="cl-util-track">
            <div
              className="cl-util-fill"
              style={{ width: `${pct}%`, background: UTIL_COLOR[level] }}
            />
          </div>
        </div>

        <div className="cl-details" role="group" aria-label="Credit line details">
          <div className="cl-detail">
            <span className="label">APR</span>
            {/* tabular-nums on APR and Risk Score keeps detail column widths stable */}
            <span className="value tabular-nums">{line.apr}%</span>
          </div>
          <div className="cl-detail">
            <span className="label">Risk Score</span>
            <span className="value tabular-nums">{line.riskScore}</span>
          </div>
          <div className="cl-detail">
            <span className="label">Opened</span>
            <span className="value">{fmtDate(line.openedAt)}</span>
          </div>
        </div>

        {line.nextInterestAccrualDate && (
          <div className="cl-accrual">
            <span className="cl-accrual-label">Next accrual</span>
            <NextAccrualChip target={line.nextInterestAccrualDate} />
          </div>
        )}

        {(() => {
          const hf = deriveHealthFactor(line.limit, line.utilized);
          return (
            <HealthFactorChart
              lineName={line.name}
              current={hf}
              data={buildHealthHistory(hf)}
            />
          );
        })()}

        <div className="cl-last-activity">
          <LastActivityStamp timestamp={line.lastActivityAt ?? line.updatedAt} />
        </div>
      </div>

      <div className="cl-card-detail">
        <RepaymentPlanChart line={line} />
      </div>
    </div>
  );
}

// ─── Credit Line Card Skeleton ───────────────────────────────────────────────

/**
 * Loading placeholder matching CreditLineCard's shape exactly so layout
 * doesn't shift when real data arrives. Reuses cl-card / cl-grid classes so
 * it inherits the responsive breakpoints from CreditLines.css with no extra CSS.
 */
function CreditLineCardSkeleton() {
  return (
    <div className="cl-card" aria-hidden="true">
      <div className="cl-card-header">
        <div className="cl-card-title-row">
          <div>
            <Skeleton style={{ width: "140px", height: "18px", marginBottom: "6px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "90px", height: "13px", borderRadius: "4px" }} />
          </div>
        </div>
        <Skeleton style={{ width: "70px", height: "22px", borderRadius: "999px" }} />
      </div>
      <div className="cl-card-body">
        <div className="cl-metrics">
          <div className="cl-metric">
            <Skeleton style={{ width: "50px", height: "12px", marginBottom: "6px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "80px", height: "18px", borderRadius: "4px" }} />
          </div>
          <div className="cl-metric">
            <Skeleton style={{ width: "60px", height: "12px", marginBottom: "6px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "80px", height: "18px", borderRadius: "4px" }} />
          </div>
          <div className="cl-metric">
            <Skeleton style={{ width: "65px", height: "12px", marginBottom: "6px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "80px", height: "18px", borderRadius: "4px" }} />
          </div>
        </div>
        <div className="cl-util-bar">
          <Skeleton style={{ width: "100%", height: "8px", borderRadius: "4px" }} />
        </div>
        <div className="cl-details">
          <div className="cl-detail">
            <Skeleton style={{ width: "40px", height: "11px", marginBottom: "4px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "50px", height: "14px", borderRadius: "4px" }} />
          </div>
          <div className="cl-detail">
            <Skeleton style={{ width: "70px", height: "11px", marginBottom: "4px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "30px", height: "14px", borderRadius: "4px" }} />
          </div>
          <div className="cl-detail">
            <Skeleton style={{ width: "55px", height: "11px", marginBottom: "4px", borderRadius: "4px" }} />
            <Skeleton style={{ width: "80px", height: "14px", borderRadius: "4px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CreditLines({ defaultLoading = true }: { defaultLoading?: boolean }) {
  const navigate = useNavigate();
  const { isReducedMotionActive } = useReducedMotion();

  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState<CreditLineStatus | "all">("all");

  const [creditLines, setCreditLines] = useState(MOCK_CREDIT_LINES);
  const hasCreditLines = creditLines.length > 0;

  // isLoading drives the full-page branded skeleton.
  // loading drives the inline card-skeleton inside the already-rendered page.
  // Both resolve at 500 ms so tests that advance by 500 ms see real content.
  const [isLoading, setIsLoading] = useState(defaultLoading);
  const [loading, setLoading] = useState(defaultLoading);

  useEffect(() => {
    if (!defaultLoading) return;
    const t = window.setTimeout(() => {
      setIsLoading(false);
      setLoading(false);
    }, 500);
    return () => window.clearTimeout(t);
  }, [defaultLoading]);

  const [showCompare, setShowCompare] = useState(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [modalTarget, setModalTarget] = useState<{
    line: (typeof MOCK_CREDIT_LINES)[0];
    currentAsset: string;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  } | null>(null);

  const handleModalClose = () => setModalTarget(null);
  const handleModalSuccess = (_incomingAsset: CollateralAsset) => setModalTarget(null);
  const handleSwapCollateral = (
    line: (typeof MOCK_CREDIT_LINES)[0],
    ref: React.RefObject<HTMLButtonElement | null>,
  ) => setModalTarget({ line, currentAsset: "ETH", triggerRef: ref });

  const handleRepay = (lineId: string) => navigate(`/repay?line=${lineId}`);

  const handleFreeze = (lineId: string) => {
    setCreditLines((prev) =>
      prev.map((cl) =>
        cl.id === lineId
          ? {
              ...cl,
              status: "Frozen" as const,
              updatedAt: new Date().toISOString(),
              statusHistory: [
                ...cl.statusHistory,
                { status: "Frozen" as const, date: new Date().toISOString(), note: "Frozen by user" },
              ],
            }
          : cl,
      ),
    );
  };

  const handleUnfreeze = (lineId: string) => {
    setCreditLines((prev) =>
      prev.map((cl) => {
        if (cl.id !== lineId) return cl;
        const lastNonFrozen = cl.statusHistory.filter((s) => s.status !== "Frozen").pop();
        const restoredStatus = lastNonFrozen?.status ?? "Active";
        return {
          ...cl,
          status: restoredStatus,
          updatedAt: new Date().toISOString(),
          statusHistory: [
            ...cl.statusHistory,
            { status: restoredStatus, date: new Date().toISOString(), note: "Unfrozen by user" },
          ],
        };
      }),
    );
  };

  const handleSchedule = (lineId: string) => console.log(`Schedule requested for ${lineId}`);
  const handleDetails = (lineId: string) => console.log(`Details requested for ${lineId}`);

  const filteredAndSorted = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? creditLines
        : creditLines.filter((cl) => cl.status === statusFilter);

    return [...filtered].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (sortField) {
        case "status":      aVal = a.status;                  bVal = b.status;                  break;
        case "limit":       aVal = a.limit;                   bVal = b.limit;                   break;
        case "utilization": aVal = a.utilized / a.limit;      bVal = b.utilized / b.limit;      break;
        case "updatedAt":   aVal = new Date(a.updatedAt).getTime(); bVal = new Date(b.updatedAt).getTime(); break;
        case "apr":         aVal = a.apr;                     bVal = b.apr;                     break;
        case "riskScore":   aVal = a.riskScore;               bVal = b.riskScore;               break;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - (bVal as number) : (bVal as number) - aVal;
    });
  }, [creditLines, sortField, sortDir, statusFilter]);

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const handleOpenCompare = () => { if (selectedLines.length === 2) setShowCompare(true); };
  const handleCloseCompare = () => { setShowCompare(false); setSelectedLines([]); };

  const toggleSelection = (id: string) => {
    setSelectedLines((prev) => {
      if (prev.includes(id)) return prev.filter((lid) => lid !== id);
      if (prev.length < 2) return [...prev, id];
      return prev;
    });
  };

  const comparePanelRef = useFocusTrap({
    isActive: showCompare,
    triggerRef,
    onEscape: handleCloseCompare,
  });

  useInertBackdrop({ isInert: showCompare, modalId: "compare-lines-drawer" });
  useBodyScrollLock({ isLocked: showCompare });

  const selectedCreditLines = useMemo(
    () => creditLines.filter((line) => selectedLines.includes(line.id)),
    [creditLines, selectedLines],
  );

  // Keyboard shortcuts: C = compare drawer, F = full compare page, N = new line, R = repay delinquent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return;
      if (e.key === "c" || e.key === "C") {
        if (selectedLines.length === 2 && !showCompare) { e.preventDefault(); handleOpenCompare(); }
      } else if (e.key === "f" || e.key === "F") {
        if (selectedLines.length === 2) {
          e.preventDefault();
          navigate(`/compare-credit-lines?a=${selectedLines[0]}&b=${selectedLines[1]}`);
        }
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault(); navigate("/open-credit");
      } else if (e.key === "r" || e.key === "R") {
        const delinquent = creditLines.find((cl) => cl.status === "Defaulted" || cl.status === "Suspended");
        if (delinquent) { e.preventDefault(); handleRepay(delinquent.id); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLines, showCompare, navigate, creditLines]);

  // ── Full-page branded skeleton (first 600 ms) ──────────────────────────────

  if (isLoading) {
    return (
      <div
        className="credit-lines-page"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading credit lines"
        data-testid="creditlines-skeleton-grid"
        data-reduced-motion={isReducedMotionActive ? "true" : "false"}
        data-motion={isReducedMotionActive ? "reduced" : undefined}
      >
        <span className="sr-only">Loading credit lines</span>
        <div className="cl-page-header">
          <div>
            <Skeleton width="180px" height="2rem" className="cl-skeleton-title" />
            <Skeleton width="220px" height="1rem" className="cl-skeleton-subtitle" />
          </div>
          <div className="cl-skeleton-actions">
            <Skeleton width="180px" height="2.75rem" className="cl-skeleton-pill" />
            <Skeleton width="172px" height="2.75rem" className="cl-skeleton-pill" />
          </div>
        </div>

        <div className="cl-filters cl-filters--skeleton">
          <div className="cl-filter-group">
            <Skeleton width="72px" height="0.8rem" />
            <Skeleton width="150px" height="2.4rem" />
          </div>
          <div className="cl-filter-group">
            <Skeleton width="64px" height="0.8rem" />
            <Skeleton width="150px" height="2.4rem" />
          </div>
          <Skeleton width="42px" height="2.4rem" />
        </div>

        <div className="cl-grid cl-grid--skeleton" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cl-card cl-card--skeleton">
              <div className="cl-card-header">
                <div style={{ width: "100%" }}>
                  <Skeleton width="72%" height="1.1rem" className="cl-skeleton-card-title" />
                  <Skeleton width="45%" height="0.8rem" className="cl-skeleton-card-subtitle" />
                </div>
                <Skeleton width="96px" height="1.95rem" />
              </div>
              <div className="cl-card-body">
                <div className="cl-metrics">
                  <Skeleton width="100%" height="3.25rem" />
                  <Skeleton width="100%" height="3.25rem" />
                  <Skeleton width="100%" height="3.25rem" />
                </div>
                <Skeleton width="100%" height="0.7rem" className="cl-skeleton-block" />
                <Skeleton width="70%" height="0.7rem" className="cl-skeleton-block" />
                <div className="cl-details">
                  <Skeleton width="100%" height="2.25rem" />
                  <Skeleton width="100%" height="2.25rem" />
                  <Skeleton width="100%" height="2.25rem" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Loaded state ──────────────────────────────────────────────────────────

  return (
    <div
      className="credit-lines-page"
      data-reduced-motion={isReducedMotionActive ? "true" : "false"}
      data-motion={isReducedMotionActive ? "reduced" : undefined}
    >
      <div className="cl-page-header" data-testid="cl-page-header">
        <div>
          <h1>Credit Lines</h1>
          <p className="subtitle">Manage your credit facilities</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            ref={triggerRef}
            className="cl-primary-btn focus-ring"
            onClick={handleOpenCompare}
            disabled={selectedLines.length !== 2}
            style={{
              opacity: selectedLines.length === 2 ? 1 : 0.6,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Compare Selected ({selectedLines.length}/2)</span>
            <KbdHint keys={["C"]} description="Compare Selected" />
          </button>

          <Link
            to={
              selectedLines.length === 2
                ? `/compare-credit-lines?a=${selectedLines[0]}&b=${selectedLines[1]}`
                : "#"
            }
            className="cl-primary-btn focus-ring"
            aria-disabled={selectedLines.length !== 2}
            aria-label={
              selectedLines.length === 2
                ? "Open full-page comparison for the two selected credit lines"
                : "Select exactly 2 credit lines to open the full comparison page"
            }
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: selectedLines.length === 2 ? "var(--text)" : "var(--muted)",
              opacity: selectedLines.length === 2 ? 1 : 0.6,
              pointerEvents: selectedLines.length === 2 ? "auto" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            tabIndex={selectedLines.length === 2 ? 0 : -1}
          >
            <span>Full Compare →</span>
            <KbdHint keys={["F"]} description="Full Compare" />
          </Link>

          <Link
            to="/open-credit"
            className="cl-primary-btn focus-ring"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <span>+ Open New Line</span>
            <KbdHint keys={["N"]} description="Open New Line" />
          </Link>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {filteredAndSorted.length} credit line{filteredAndSorted.length !== 1 ? "s" : ""} found
        {statusFilter !== "all" ? ` with status ${statusFilter}` : ""}
      </div>

      <div className="cl-filters">
        <div className="cl-filter-group">
          <label>Status</label>
          <select
            className="focus-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CreditLineStatus | "all")}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
            <option value="Frozen">Frozen</option>
            <option value="Defaulted">Defaulted</option>
            <option value="Closed">Closed</option>
          </select>
        </div>
        <div className="cl-filter-group">
          <label>Sort By</label>
          <select
            className="focus-ring"
            value={sortField}
            onChange={(e) => handleSort(e.target.value as SortField)}
          >
            <option value="updatedAt">Last Updated</option>
            <option value="status">Status</option>
            <option value="limit">Credit Limit</option>
            <option value="utilization">Utilization</option>
            <option value="apr">APR</option>
            <option value="riskScore">Risk Score</option>
          </select>
        </div>
        <button
          className="cl-sort-dir focus-ring"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {showCompare && selectedCreditLines.length === 2 && (
        <div
          id="compare-lines-drawer"
          ref={comparePanelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-lines-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(15, 23, 42, 0.45)",
            pointerEvents: "auto",
          }}
        >
          <div style={{ width: "min(480px, 100%)", height: "100%", position: "relative", zIndex: 1201 }}>
            <CompareLinesPanel lines={selectedCreditLines} onClose={handleCloseCompare} />
          </div>
        </div>
      )}

      <div aria-live="polite" aria-busy={loading}>
        <span role="status" aria-busy={loading} className="sr-only" aria-live="polite">
          {loading ? "Loading credit lines" : "Credit lines loaded"}
        </span>

        {loading ? (
          <div className="cl-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <CreditLineCardSkeleton key={i} />
            ))}
          </div>
        ) : !hasCreditLines ? (
          <div className="cl-empty" role="region" aria-label="No credit lines">
            <NoLines className="empty-state-illustration--muted" />
            <h2 className="cl-empty-title">Get started with Credit Lines</h2>
            <p className="cl-empty-desc">
              Credit lines give you access to flexible capital when you need it.
              Open your first line and unlock funding tailored to your business.
            </p>
            <ul className="cl-empty-features">
              <li>Flexible funding up to $500K</li>
              <li>Competitive rates from 7.5% APR</li>
              <li>Quick approval with digital collateral</li>
            </ul>
            <Link to="/open-credit" className="cl-primary-btn">
              Open Credit Line
            </Link>
          </div>
        ) : (
          <div className="cl-grid" data-testid="cl-grid">
            {filteredAndSorted.map((line) => (
              <CreditLineCard
                key={line.id}
                line={line}
                isSelected={selectedLines.includes(line.id)}
                onToggle={() => toggleSelection(line.id)}
                onSwapCollateral={handleSwapCollateral}
                onRepay={() => handleRepay(line.id)}
                onFreeze={handleFreeze}
                onUnfreeze={handleUnfreeze}
                onSchedule={() => handleSchedule(line.id)}
                onDetails={() => handleDetails(line.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Repayment Schedule (Issue #428) ──────────────────────────────────
       * Aggregate, chronological timeline of every past installment AND
       * forward-looking payment across the user's credit lines. Built from
       * the existing mock data via buildRepaymentScheduleFromLines so the
       * timeline updates as the upstream state changes.
       * Numeric cells inside RepaymentSchedule carry tabular-nums (issue #573). */}
      {filteredAndSorted.length > 0 && (
        <section
          className="cl-repayment-schedule"
          aria-labelledby="cl-repayment-schedule-heading"
        >
          <h2 id="cl-repayment-schedule-heading" className="cl-section-title">
            Repayment Schedule
          </h2>
          <p className="cl-section-subtitle">
            Past installments and upcoming payments across your credit lines.
          </p>
          <RepaymentSchedule
            schedule={buildRepaymentScheduleFromLines(filteredAndSorted)}
            title="All scheduled repayments"
          />
        </section>
      )}

      {/* Collateral substitution modal — mounted at page level to overlay everything */}
      {modalTarget && (
        <CollateralSubstitutionModal
          isOpen
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          creditLineName={modalTarget.line.name}
          loanBalance={modalTarget.line.utilized}
          currentAsset={modalTarget.currentAsset}
          triggerRef={modalTarget.triggerRef}
        />
      )}
    </div>
  );
}
