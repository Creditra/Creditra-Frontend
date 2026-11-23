import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import CompareLinesPanel from "../components/CompareLinesPanel";
import { CollateralSubstitutionModal } from "../components/CollateralSubstitutionModal";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInertBackdrop } from "../hooks/useInertBackdrop";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useCreditLines } from "../hooks/useCreditLines";
import { useCreditLineListState, DEFAULT_PAGE } from "../hooks/useCreditLineListState";
import { setLineFrozen } from "../services/creditLine";
import { applyTransition, getUnfrozenStatus } from "../lib/credit-line-status";
import type { CreditLine } from "../types/creditLine";
import type { CollateralAsset } from "../types/collateral";
import { KbdHint } from "../components/KbdHint";
import { LiveRegion } from "../components/LiveRegion";
import { now as clockNow } from "../lib/clock";
import { RepaymentSchedule, buildRepaymentScheduleFromLines } from "../components/RepaymentSchedule";
import { useReducedMotion } from "../context/ReducedMotionContext";
import { loadComparisonSelection, saveComparisonSelection } from "../utils/comparisonSelection";
import { CreditLineFilterBar } from "../components/credit-lines/CreditLineFilterBar";
import { CreditLineList } from "../components/credit-lines/CreditLineList";
import "./CreditLines.css";
import { findAssetByName } from "../utils/collateral";

const CreditLineDetailDrawer = lazy(() => import("../components/CreditLineDetailDrawer").then((m) => ({ default: m.CreditLineDetailDrawer })));

function CreditLineCardSkeleton() {
  return (
    <div className="cl-card cl-card--skeleton" aria-hidden="true">
      <div className="cl-card-header">
        <div className="cl-card-title-row"><div><Skeleton style={{ width: "140px", height: "18px", marginBottom: "6px", borderRadius: "4px" }} /><Skeleton style={{ width: "90px", height: "13px", borderRadius: "4px" }} /></div></div>
        <Skeleton style={{ width: "70px", height: "22px", borderRadius: "999px" }} />
      </div>
      <div className="cl-card-body">
        <div className="cl-metrics">
          {["50px", "60px", "65px"].map((width) => (
            <div className="cl-metric" key={width}><Skeleton style={{ width, height: "12px", marginBottom: "6px", borderRadius: "4px" }} /><Skeleton style={{ width: "80px", height: "18px", borderRadius: "4px" }} /></div>
          ))}
        </div>
        <div className="cl-util-bar"><Skeleton style={{ width: "100%", height: "8px", borderRadius: "4px" }} /></div>
        <div className="cl-details">
          {[["40px", "50px"], ["70px", "30px"], ["55px", "80px"]].map(([label, value]) => (
            <div className="cl-detail" key={label}><Skeleton style={{ width: label, height: "11px", marginBottom: "4px", borderRadius: "4px" }} /><Skeleton style={{ width: value, height: "14px", borderRadius: "4px" }} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CreditLines({ defaultLoading = true }: { defaultLoading?: boolean }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useReducedMotion();
  const [announcement, setAnnouncement] = useState("");
  const { lines: creditLines, status, error, refetch, setLines } = useCreditLines();
  void defaultLoading;
  const { sortField, sortDir, statusFilter, setListParams, filteredAndSorted, stablePage, handleSort } = useCreditLineListState(creditLines);

  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [retryLineId, setRetryLineId] = useState<string | null>(null);
  const inFlightRef = useRef<Map<string, { frozen: boolean; previousLine: CreditLine }>>(new Map());

  const handleFreezeToggle = useCallback(async (lineId: string, frozen: boolean) => {
    const currentLine = creditLines.find((line) => line.id === lineId);
    if (!currentLine) return;
    const previousLine = { ...currentLine, statusHistory: [...currentLine.statusHistory] };
    let transition: ReturnType<typeof applyTransition>;
    try {
      transition = applyTransition(currentLine, frozen ? "Frozen" : getUnfrozenStatus(currentLine), { reason: frozen ? "Freezing…" : "Unfreezing…", now: clockNow() });
    } catch (transitionError) {
      setFreezeError(transitionError instanceof Error ? transitionError.message : "This credit-line status change is not allowed.");
      return;
    }
    inFlightRef.current.set(lineId, { frozen, previousLine });
    setLines(creditLines.map((line) => line.id === lineId ? { ...line, status: transition.status, updatedAt: transition.historyEntry.date, statusHistory: [...line.statusHistory, transition.historyEntry] } : line));
    setAnnouncement(`Credit line ${currentLine.name} ${frozen ? "freezing…" : "unfreezing…"}`);
    setFreezeError(null); setRetryLineId(null);
    try {
      const serverLine = await setLineFrozen(lineId, frozen, creditLines);
      const latest = inFlightRef.current.get(lineId);
      if (latest && latest.frozen !== frozen) return;
      setLines(creditLines.map((line) => line.id === lineId ? serverLine : line));
      setAnnouncement(`Credit line ${currentLine.name} ${frozen ? "frozen." : "unfrozen."}`);
      inFlightRef.current.delete(lineId);
    } catch {
      const latest = inFlightRef.current.get(lineId);
      if (latest && latest.frozen !== frozen) return;
      setLines(creditLines.map((line) => line.id === lineId ? previousLine : line));
      setAnnouncement(`Failed to ${frozen ? "freeze" : "unfreeze"} ${currentLine.name}. ${frozen ? "Free" : "Unfree"}ze could not be completed — try again.`);
      setFreezeError(`Failed to ${frozen ? "freeze" : "unfreeze"} ${currentLine.name}. Please try again.`);
      setRetryLineId(lineId); inFlightRef.current.delete(lineId);
    }
  }, [creditLines, setLines]);

  const handleRetryFreeze = () => {
    if (!retryLineId) return;
    const line = creditLines.find((item) => item.id === retryLineId);
    handleFreezeToggle(retryLineId, line ? line.status !== "Frozen" : true);
  };

  const [showCompare, setShowCompare] = useState(false);
  const [selectedLines, setSelectedLines] = useState<string[]>(() => loadComparisonSelection());
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    saveComparisonSelection(selectedLines);
  }, [selectedLines]);

  const [modalTarget, setModalTarget] = useState<{ line: CreditLine; currentAsset: CollateralAsset | undefined; triggerRef: RefObject<HTMLButtonElement | null> } | null>(null);
  const handleSwapCollateral = (line: CreditLine, lineTriggerRef: RefObject<HTMLButtonElement | null>) => setModalTarget({ line, currentAsset: findAssetByName(line.collateral), triggerRef: lineTriggerRef });

  const selectedLineId = searchParams.get("line");
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedLine = useMemo(() => selectedLineId ? creditLines.find((line) => line.id === selectedLineId) ?? null : null, [creditLines, selectedLineId]);
  const handleRepay = (lineId: string) => navigate(`/repay?line=${lineId}`);
  const handleSchedule = (lineId: string) => navigate(`/repay?line=${lineId}`);
  const handleDetails = useCallback((lineId: string, lineTrigger?: RefObject<HTMLButtonElement | null>) => {
    drawerTriggerRef.current = lineTrigger?.current ?? null;
    const next = new URLSearchParams(searchParams); next.set("line", lineId); setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const handleCloseDetails = useCallback(() => {
    const next = new URLSearchParams(searchParams); next.delete("line"); setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleOpenCompare = () => { if (selectedLines.length === 2) setShowCompare(true); };
  const handleCloseCompare = () => { setShowCompare(false); setSelectedLines([]); };
  const toggleSelection = (id: string) => setSelectedLines((previous) => previous.includes(id) ? previous.filter((lineId) => lineId !== id) : previous.length < 2 ? [...previous, id] : previous);
  const comparePanelRef = useFocusTrap({ isActive: showCompare, triggerRef, onEscape: handleCloseCompare });
  useInertBackdrop({ isInert: showCompare, modalId: "compare-lines-drawer" });
  useBodyScrollLock({ isLocked: showCompare });
  const selectedCreditLines = useMemo(() => creditLines.filter((line) => selectedLines.includes(line.id)), [creditLines, selectedLines]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if ((event.key === "c" || event.key === "C") && selectedLines.length === 2 && !showCompare) { event.preventDefault(); handleOpenCompare(); }
      else if ((event.key === "f" || event.key === "F") && selectedLines.length === 2) { event.preventDefault(); navigate(`/compare-credit-lines?a=${selectedLines[0]}&b=${selectedLines[1]}`); }
      else if (event.key === "n" || event.key === "N") { event.preventDefault(); navigate("/open-credit"); }
      else if (event.key === "r" || event.key === "R") {
        const delinquent = creditLines.find((line) => line.status === "Defaulted" || line.status === "Suspended");
        if (delinquent) { event.preventDefault(); handleRepay(delinquent.id); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLines, showCompare, navigate, creditLines]);

  if (status === "loading") return (
    <div className="credit-lines-page" data-testid="creditlines-skeleton-grid" role="status" aria-live="polite" aria-busy="true" aria-label="Loading credit lines">
      <div className="cl-page-header"><div><Skeleton width="180px" height="2rem" className="cl-skeleton-title" /><Skeleton width="220px" height="1rem" className="cl-skeleton-subtitle" /></div><div className="cl-skeleton-actions"><Skeleton width="180px" height="2.75rem" className="cl-skeleton-pill" /><Skeleton width="172px" height="2.75rem" className="cl-skeleton-pill" /></div></div>
      <div className="cl-filters cl-filters--skeleton"><div className="cl-filter-group"><Skeleton width="72px" height="0.8rem" /><Skeleton width="150px" height="2.4rem" /></div><div className="cl-filter-group"><Skeleton width="64px" height="0.8rem" /><Skeleton width="150px" height="2.4rem" /></div><Skeleton width="42px" height="2.4rem" /></div>
      <div className="cl-grid cl-grid--skeleton" aria-hidden="true">{Array.from({ length: 3 }).map((_, index) => <CreditLineCardSkeleton key={index} />)}</div>
    </div>
  );

  if (status === "error") return <div className="credit-lines-page"><div role="alert" className="cl-error-card"><p>{error?.message ?? "Unable to load credit lines."}</p><button type="button" className="cl-primary-btn focus-ring" onClick={() => void refetch().catch(() => undefined)}>Retry</button></div></div>;

  return (
    <div className="credit-lines-page">
      <div className="cl-page-header" data-testid="cl-page-header">
        <div><h1>Credit Lines</h1><p className="subtitle">Manage your credit facilities</p></div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button ref={triggerRef} className="cl-primary-btn focus-ring" onClick={handleOpenCompare} disabled={selectedLines.length !== 2} style={{ opacity: selectedLines.length === 2 ? 1 : 0.6, display: "inline-flex", alignItems: "center", gap: "0.5rem" }}><span>Compare Selected ({selectedLines.length}/2)</span><KbdHint keys={["C"]} description="Compare Selected" /></button>
          <Link to={selectedLines.length === 2 ? `/compare-credit-lines?a=${selectedLines[0]}&b=${selectedLines[1]}` : "#"} className="cl-primary-btn focus-ring" aria-disabled={selectedLines.length !== 2} aria-label={selectedLines.length === 2 ? "Open full-page comparison for the two selected credit lines" : "Select exactly 2 credit lines to open the full comparison page"} style={{ background: "var(--surface)", border: "1px solid var(--border)", color: selectedLines.length === 2 ? "var(--text)" : "var(--muted)", opacity: selectedLines.length === 2 ? 1 : 0.6, pointerEvents: selectedLines.length === 2 ? "auto" : "none", display: "inline-flex", alignItems: "center", gap: "0.5rem" }} tabIndex={selectedLines.length === 2 ? 0 : -1}><span>Full Compare →</span><KbdHint keys={["F"]} description="Full Compare" /></Link>
          <Link to="/open-credit" className="cl-primary-btn focus-ring" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}><span>+ Open New Line</span><KbdHint keys={["N"]} description="Open New Line" /></Link>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{filteredAndSorted.length} credit line{filteredAndSorted.length !== 1 ? "s" : ""} found{statusFilter !== "all" ? ` with status ${statusFilter}` : ""}</div>
      <CreditLineFilterBar statusFilter={statusFilter} sortField={sortField} sortDir={sortDir} onStatusChange={(status) => setListParams({ status, page: DEFAULT_PAGE })} onSortChange={handleSort} onDirectionChange={() => setListParams({ dir: sortDir === "asc" ? "desc" : "asc" })} />
      <LiveRegion message={announcement} id="cl-live-region" />
      {freezeError && <div className="banner-alert banner-alert--danger" role="alert" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", margin: "0 0 1rem 0", borderRadius: "8px", background: "rgba(248, 81, 73, 0.1)", border: "1px solid rgba(248, 81, 73, 0.3)" }}><p style={{ margin: 0, flex: 1 }}>{freezeError}</p><button onClick={handleRetryFreeze} className="cl-primary-btn focus-ring" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }} data-testid="retry-freeze-btn">Retry</button><button onClick={() => { setFreezeError(null); setRetryLineId(null); }} className="banner-alert__close" aria-label="Dismiss freeze error" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>✕</button></div>}
      {showCompare && selectedCreditLines.length === 2 && <div id="compare-lines-drawer" ref={comparePanelRef} role="dialog" aria-modal="true" aria-labelledby="compare-lines-title" style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", justifyContent: "flex-end", background: "rgba(15, 23, 42, 0.45)", pointerEvents: "auto" }}><div style={{ width: "min(480px, 100%)", height: "100%", position: "relative", zIndex: 1201 }}><CompareLinesPanel lines={selectedCreditLines} onClose={handleCloseCompare} /></div></div>}
      <div role="status" aria-live="polite" aria-busy={false}>
        <CreditLineList filteredCount={filteredAndSorted.length} totalCount={creditLines.length} items={stablePage.items} pageIndex={stablePage.pageIndex} pageCount={stablePage.pageCount} selectedLines={selectedLines} statusFilter={statusFilter} onToggle={toggleSelection} onClearFilters={() => setListParams({ status: "all", page: DEFAULT_PAGE })} onPageChange={(page) => setListParams({ page })} onSwapCollateral={handleSwapCollateral} onRepay={handleRepay} onFreeze={(id) => handleFreezeToggle(id, true)} onUnfreeze={(id) => handleFreezeToggle(id, false)} onSchedule={handleSchedule} onDetails={handleDetails} />
      </div>
      {filteredAndSorted.length > 0 && <section className="cl-repayment-schedule" aria-labelledby="cl-repayment-schedule-heading"><h2 id="cl-repayment-schedule-heading" className="cl-section-title">Repayment Schedule</h2><p className="cl-section-subtitle">Past installments and upcoming payments across your credit lines.</p><RepaymentSchedule schedule={buildRepaymentScheduleFromLines(filteredAndSorted)} title="All scheduled repayments" /></section>}
      {modalTarget && <CollateralSubstitutionModal isOpen onClose={() => setModalTarget(null)} onSuccess={(_incomingAsset: CollateralAsset) => setModalTarget(null)} creditLineName={modalTarget.line.name} loanBalance={modalTarget.line.utilized} currentAsset={modalTarget.currentAsset} triggerRef={modalTarget.triggerRef} />}
      {selectedLine && <Suspense fallback={null}><CreditLineDetailDrawer line={selectedLine} onClose={handleCloseDetails} triggerRef={drawerTriggerRef} /></Suspense>}
    </div>
  );
}
