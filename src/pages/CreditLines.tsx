import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  Suspense,
  useContext,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LimitIncreaseModal } from "../components/LimitIncreaseModal";
import { Skeleton } from "../components/Skeleton";
import CompareLinesPanel from "../components/CompareLinesPanel";
import { CollateralSubstitutionModal } from "../components/CollateralSubstitutionModal";
import { CollateralAdjustModal } from "../components/CollateralAdjustModal";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useInertBackdrop } from "../hooks/useInertBackdrop";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useCreditLines } from "../hooks/useCreditLines";
import { useCreditLineListState, DEFAULT_PAGE } from "../hooks/useCreditLineListState";
import { setLineFrozen } from "../services/creditLine";
import { applyTransition, getUnfrozenStatus } from "../lib/credit-line-status";
import type { CreditLine, CreditLineStatus, SortField } from "../types/creditLine";
import type { CollateralAsset } from "../types/collateral";
import "./CreditLines.css";
import { KbdHint } from "../components/KbdHint";
import { now as clockNow } from "../lib/clock";
import { evaluateLimitIncreaseEligibility } from "../lib/limit-increase";
import { walletIdentityKey } from "../context/WalletContext";
import { NotificationContext } from "../context/NotificationContext";
import {
  getLatestLimitIncreaseRequest,
  useLimitIncreaseRequestsForWallet,
} from "../state/limitIncreaseRequests";
import {
  RepaymentSchedule,
  buildRepaymentScheduleFromLines,
} from "../components/RepaymentSchedule";
import {
  createStableOrder,
  getStablePage,
  reconcileStableOrder,
} from "../utils/stableListPagination";
import {
  MAX_COMPARE,
  buildComparisonUrl,
  loadComparisonSelection,
  saveComparisonSelection,
} from "../utils/comparisonSelection";
import { CreditLineDetailDrawer } from "../components/CreditLineDetailDrawer";
import { CreditLineCardSkeleton } from "../components/credit-lines/CreditLineCard";
import { CreditLineFilterBar } from "../components/credit-lines/CreditLineFilterBar";
import { CreditLineList } from "../components/credit-lines/CreditLineList";

export { CreditLineCard } from "../components/credit-lines/CreditLineCard";

const CREDIT_LINES_PAGE_SIZE = 6;
const getCreditLineId = (line: CreditLine) => line.id;

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CreditLines({
  defaultLoading = true,
}: {
  defaultLoading?: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Track both the OS-level prefers-reduced-motion signal AND the in-app
  // override (ReducedMotionContext toggle).  Exposed as a data-attribute on
  // the page root so CSS / tests / dev-tools can single-source the override.

  const [announcement, setAnnouncement] = useState("");

  // ── Credit lines come from the global provider (useCreditLines) so that
  //    freeze/unfreeze changes are visible to Dashboard, Quick Repay, etc.
  //    The hook reads from the in-memory store in useCreditLines.ts; the
  //    setLineFrozen service writes to that same store.
  const { lines: creditLines, status, error, refetch, setLines, owner, wallet } = useCreditLines();
  const {
    sortField,
    sortDir,
    statusFilter,
    pageIndex,
    setListParams,
    filteredAndSorted,
  } = useCreditLineListState(creditLines);
  const walletKey = wallet ? walletIdentityKey(wallet) : owner;
  const { requests, create: createLimitIncreaseRequest } =
    useLimitIncreaseRequestsForWallet(walletKey);
  const notificationContext = useContext(NotificationContext);
  const increaseStateByLine = useMemo(
    () =>
      new Map(
        creditLines.map((line) => {
          const latestRequest = getLatestLimitIncreaseRequest(requests, line.id);
          const eligibility = evaluateLimitIncreaseEligibility(
            line,
            clockNow(),
            latestRequest?.createdAt,
          );
          const disabledReasons = [...eligibility.reasons];
          const increasePending = requests.some(
            (request) => request.creditLineId === line.id && request.status === "pending",
          );
          if (!walletKey) disabledReasons.push("Connect a wallet to request a limit increase.");
          if (increasePending) {
            disabledReasons.push("A limit increase request is already pending.");
          }
          return [
            line.id,
            { maxRequestable: eligibility.maxRequestable, disabledReasons, increasePending },
          ] as const;
        }),
      ),
    [creditLines, requests, walletKey],
  );
  const [simulatedLoading, setSimulatedLoading] = useState(defaultLoading);

  useEffect(() => {
    if (!defaultLoading) return;
    const timer = setTimeout(() => {
      setSimulatedLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [defaultLoading]);

  // ── Freeze/unfreeze optimistic state ─────────────────────────────────
  /** Deep snapshot of each line before an optimistic update, keyed by lineId.
   *  Used for exact rollback on failure. */
  const [freezeError, setFreezeError] = useState<string | null>(null);
  const [retryLineId, setRetryLineId] = useState<string | null>(null);

  /** Per-line in-flight freeze/unfreeze operations for serialisation.
   *  Keyed by lineId → { frozen: boolean; previousLine: CreditLine } */
  const inFlightRef = useRef<Map<string, { frozen: boolean; previousLine: CreditLine }>>(new Map());

  const creditLinesRef = useRef(creditLines);
  creditLinesRef.current = creditLines;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  /** Persist a freeze or unfreeze through the credit data source with
   *  optimistic UI and exact rollback on failure. Concurrent toggles on
   *  the same line are serialised: the latest intent wins, and an earlier
   *  failure cannot roll back a later success. */
  const handleFreezeToggle = useCallback(
    async (lineId: string, frozen: boolean) => {
      const lines = creditLinesRef.current;
      const currentLine = lines.find((cl) => cl.id === lineId);
      if (!currentLine) return;

      // Serialise: if there is already an in-flight operation for this line,
      // the new intent replaces it. The earlier operation's failure will
      // check `inFlightRef` and see it no longer holds the latest intent,
      // so it won't roll back.
      const previousLine = { ...currentLine, statusHistory: [...currentLine.statusHistory] };
      const targetStatus = frozen ? "Frozen" : getUnfrozenStatus(currentLine);
      let transition: ReturnType<typeof applyTransition>;
      try {
        transition = applyTransition(currentLine, targetStatus, {
          reason: frozen ? "Freezing…" : "Unfreezing…",
          now: clockNow(),
        });
      } catch (transitionError) {
        setFreezeError(
          transitionError instanceof Error
            ? transitionError.message
            : "This credit-line status change is not allowed.",
        );
        return;
      }

      inFlightRef.current.set(lineId, { frozen, previousLine });

      // Optimistic update: apply the target status immediately
      const optimisticLines: CreditLine[] = lines.map((cl) =>
          cl.id === lineId
            ? {
                ...cl,
                status: transition.status,
                updatedAt: transition.historyEntry.date,
                statusHistory: [
                  ...cl.statusHistory,
                  transition.historyEntry,
                ],
              }
            : cl,
        );
      setLines(optimisticLines);
      setAnnouncement(`Credit line ${currentLine.name} ${frozen ? "freezing…" : "unfreezing…"}`);
      setFreezeError(null);
      setRetryLineId(null);

      try {
        const serverLine = await setLineFrozen(lineId, frozen, lines);

        // Check if we're still the latest intent for this line.
        // If a newer toggle has started, don't overwrite — the newer one wins.
        const latest = inFlightRef.current.get(lineId);
        if (latest && latest.frozen !== frozen) {
          // A newer intent has started; don't apply our result.
          return;
        }

        // Apply the server-authoritative record
        setLines(creditLinesRef.current.map((cl) => (cl.id === lineId ? serverLine : cl)));
        setAnnouncement(
          `Credit line ${currentLine.name} ${frozen ? "frozen." : "unfrozen."}`,
        );
        inFlightRef.current.delete(lineId);
      } catch (err) {
        // Check if we're still the latest intent.
        const latest = inFlightRef.current.get(lineId);
        if (latest && latest.frozen !== frozen) {
          // A newer intent has started; don't roll back — the newer one wins.
          return;
        }

        // Exact rollback: restore the exact previous line object
        setLines(creditLinesRef.current.map((cl) => (cl.id === lineId ? previousLine : cl)));
        setAnnouncement(
          `Failed to ${frozen ? "freeze" : "unfreeze"} ${currentLine.name}. ${frozen ? "Free" : "Unfree"}ze could not be completed — try again.`,
        );
        setFreezeError(
          `Failed to ${frozen ? "freeze" : "unfreeze"} ${currentLine.name}. Please try again.`,
        );
        setRetryLineId(lineId);
        inFlightRef.current.delete(lineId);
      }
    },
    [setLines],
  );

  const handleFreeze = useCallback(
    (lineId: string) => {
      void handleFreezeToggle(lineId, true);
    },
    [handleFreezeToggle],
  );

  const handleUnfreeze = useCallback(
    (lineId: string) => {
      void handleFreezeToggle(lineId, false);
    },
    [handleFreezeToggle],
  );

  const handleRetryFreeze = () => {
    if (retryLineId) {
      const line = creditLines.find((cl) => cl.id === retryLineId);
      // Retry with the opposite of the current frozen state
      const frozen = line ? line.status !== "Frozen" : true;
      handleFreezeToggle(retryLineId, frozen);
    }
  };

  const [showCompare, setShowCompare] = useState(false);
  const [selectedLines, setSelectedLines] = useState<string[]>(() =>
    loadComparisonSelection(),
  );
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    saveComparisonSelection(selectedLines);
  }, [selectedLines]);
  const [modalTarget, setModalTarget] = useState<{
    line: CreditLine;
    currentAsset: CollateralAsset;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  } | null>(null);

  const [adjustModalTarget, setAdjustModalTarget] = useState<{
    line: CreditLine;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  } | null>(null);
  const [limitIncreaseTarget, setLimitIncreaseTarget] = useState<{
    line: CreditLine;
    maxRequestable: number;
    triggerRef: React.RefObject<HTMLButtonElement | null>;
  } | null>(null);

  const handleOpenLimitIncrease = (
    line: CreditLine,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => {
    const state = increaseStateByLine.get(line.id);
    if (!walletKey || !state || state.disabledReasons.length > 0) return;
    setLimitIncreaseTarget({ line, maxRequestable: state.maxRequestable, triggerRef });
  };

  const handleSubmitLimitIncrease = ({
    amount,
    reason,
  }: {
    amount: number;
    reason: string;
  }) => {
    if (!walletKey) throw new Error("Connect a wallet before submitting a request.");
    if (!limitIncreaseTarget) {
      throw new Error("Select a credit line before submitting a request.");
    }
    createLimitIncreaseRequest({
      creditLineId: limitIncreaseTarget.line.id,
      amount,
      reason,
    });
    notificationContext?.addToast({
      type: "success",
      category: "credit_line",
      title: "Limit increase requested",
      message: `Your request for ${limitIncreaseTarget.line.name} has been saved.`,
      saveToHistory: true,
    });
  };

  const handleModalClose = () => setModalTarget(null);
  const handleModalSuccess = (_incomingAsset: CollateralAsset) => {
    setModalTarget(null);
  };
  const handleSwapCollateral = useCallback(
    (
      line: CreditLine,
      triggerRef: React.RefObject<HTMLButtonElement | null>,
    ) => {
      setModalTarget({
        line,
        currentAsset: "ETH",
        triggerRef,
      });
    },
    [],
  );

  const handleAdjustCollateral = (
    line: CreditLine,
    triggerRef: React.RefObject<HTMLButtonElement | null>,
  ) => {
    setAdjustModalTarget({
      line,
      triggerRef,
    });
  };

  const selectedLineId = searchParams.get("line");
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedLine = useMemo(
    () =>
      selectedLineId
        ? (creditLines.find((cl) => cl.id === selectedLineId) ?? null)
        : null,
    [creditLines, selectedLineId],
  );

  const handleRepay = useCallback(
    (lineId: string) => {
      navigate(`/repay?line=${lineId}`);
    },
    [navigate],
  );

  const handleSchedule = useCallback(
    (lineId: string) => {
      navigate(`/repay?line=${lineId}`);
    },
    [navigate],
  );

  const handleDetails = useCallback(
    (lineId: string, trigger?: React.RefObject<HTMLButtonElement | null>) => {
      drawerTriggerRef.current = trigger?.current ?? null;
      const next = new URLSearchParams(searchParamsRef.current);
      next.set("line", lineId);
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const handleCloseDetails = useCallback(() => {
    const next = new URLSearchParams(searchParamsRef.current);
    next.delete("line");
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const paginationKey = `${statusFilter}:${sortField}:${sortDir}`;
  const prevPaginationKeyRef = useRef(paginationKey);
  const latestFilteredRef = useRef(filteredAndSorted);
  latestFilteredRef.current = filteredAndSorted;
  const [stableOrder, setStableOrder] = useState(() =>
    createStableOrder(filteredAndSorted, getCreditLineId),
  );

  // A sort/filter change is an explicit new query, so it starts a fresh
  // pagination session. Live data updates do not reset this anchor.
  useEffect(() => {
    setStableOrder(
      createStableOrder(latestFilteredRef.current, getCreditLineId),
    );
    if (prevPaginationKeyRef.current !== paginationKey) {
      prevPaginationKeyRef.current = paginationKey;
      setListParams({ page: DEFAULT_PAGE });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationKey]);

  // Preserve the session's existing slots during live updates and append only
  // genuinely new credit-line ids. Missing ids remain tombstones so page
  // boundaries never collapse underneath a user who already paged forward.
  useEffect(() => {
    setStableOrder((previous) =>
      reconcileStableOrder(previous, filteredAndSorted, getCreditLineId),
    );
  }, [filteredAndSorted]);

  const effectiveStableOrder = stableOrder.length === 0 && filteredAndSorted.length > 0
    ? createStableOrder(filteredAndSorted, getCreditLineId)
    : stableOrder;
  const stablePage = useMemo(
    () =>
      getStablePage(filteredAndSorted, effectiveStableOrder, {
        pageIndex,
        pageSize: CREDIT_LINES_PAGE_SIZE,
        getId: getCreditLineId,
      }),
    [filteredAndSorted, effectiveStableOrder, pageIndex],
  );

  useEffect(() => {
    if (stablePage.pageIndex !== pageIndex) {
      setListParams({ page: stablePage.pageIndex });
    }
  }, [stablePage.pageIndex, pageIndex]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setListParams({ dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      setListParams({ sort: field, dir: "desc" });
    }
  };

  const handleOpenCompare = () => {
    if (selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE) {
      setShowCompare(true);
    }
  };

  const handleCloseCompare = () => {
    setShowCompare(false);
    setSelectedLines([]);
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedLines((prev) => {
      if (prev.includes(id)) {
        return prev.filter((lineId) => lineId !== id);
      }
      if (prev.length < MAX_COMPARE) {
        return [...prev, id];
      }
      setAnnouncement(`You can compare up to ${MAX_COMPARE} credit lines at a time.`);
      return prev;
    });
  }, []);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "c" || e.key === "C") {
        if (selectedLines.length === 2 && !showCompare) {
          e.preventDefault();
          handleOpenCompare();
        }
      } else if (e.key === "f" || e.key === "F") {
        if (selectedLines.length === 2) {
          e.preventDefault();
          navigate(
            `/compare-credit-lines?a=${selectedLines[0]}&b=${selectedLines[1]}`,
          );
        }
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        navigate("/open-credit");
      } else if (e.key === "r" || e.key === "R") {
        const delinquentLine = creditLines.find(
          (cl) => cl.status === "Defaulted" || cl.status === "Suspended",
        );
        if (delinquentLine) {
          e.preventDefault();
          handleRepay(delinquentLine.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedLines, showCompare, navigate, creditLines]);

  if (status === "loading" || simulatedLoading) {
    return (
      <div
        className="credit-lines-page"
        data-testid="creditlines-skeleton-grid"
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading credit lines"
      >
        <div className="cl-page-header">
          <div>
            <Skeleton
              width="180px"
              height="2rem"
              className="cl-skeleton-title"
            />
            <Skeleton
              width="220px"
              height="1rem"
              className="cl-skeleton-subtitle"
            />
          </div>
          <div className="cl-skeleton-actions">
            <Skeleton
              width="180px"
              height="2.75rem"
              className="cl-skeleton-pill"
            />
            <Skeleton
              width="172px"
              height="2.75rem"
              className="cl-skeleton-pill"
            />
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
          {Array.from({ length: 3 }).map((_, index) => (
            <CreditLineCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="credit-lines-page">
        <div role="alert" className="cl-error-card">
          <p>{error?.message ?? "Unable to load credit lines."}</p>
          <button
            type="button"
            className="cl-primary-btn focus-ring"
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="credit-lines-page">
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
            disabled={selectedLines.length < 2 || selectedLines.length > MAX_COMPARE}
            style={{
              opacity:
                selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                  ? 1
                  : 0.6,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>Compare Selected ({selectedLines.length}/{MAX_COMPARE})</span>
            <KbdHint keys={["C"]} description="Compare Selected" />
          </button>
          {/* Full-page compare */}
          <Link
            to={
              selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                ? buildComparisonUrl(selectedLines)
                : "#"
            }
            className="cl-primary-btn focus-ring"
            aria-disabled={
              selectedLines.length < 2 || selectedLines.length > MAX_COMPARE
            }
            aria-label={
              selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                ? `Open full-page comparison for the ${selectedLines.length} selected credit lines`
                : `Select between 2 and ${MAX_COMPARE} credit lines to open the full comparison page`
            }
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color:
                selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                  ? "var(--text)"
                  : "var(--muted)",
              opacity:
                selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                  ? 1
                  : 0.6,
              pointerEvents:
                selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                  ? "auto"
                  : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            tabIndex={
              selectedLines.length >= 2 && selectedLines.length <= MAX_COMPARE
                ? 0
                : -1
            }
          >
            <span>Full Compare →</span>
            <KbdHint keys={["F"]} description="Full Compare" />
          </Link>
          <Link
            to="/open-credit"
            className="cl-primary-btn focus-ring"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>+ Open New Line</span>
            <KbdHint keys={["N"]} description="Open New Line" />
          </Link>
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {filteredAndSorted.length} credit line
        {filteredAndSorted.length !== 1 ? "s" : ""} found
        {statusFilter !== "all" ? ` with status ${statusFilter}` : ""}
      </div>

      <CreditLineFilterBar
        statusFilter={statusFilter}
        sortField={sortField}
        sortDir={sortDir}
        onStatusChange={(status) => setListParams({ status, page: DEFAULT_PAGE })}
        onSortChange={handleSort}
        onDirectionChange={() => setListParams({ dir: sortDir === "asc" ? "desc" : "asc" })}
      />
      {freezeError && (
        <div
          className="banner-alert banner-alert--danger"
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            margin: "0 0 1rem 0",
            borderRadius: "8px",
            background: "rgba(248, 81, 73, 0.1)",
            border: "1px solid rgba(248, 81, 73, 0.3)",
          }}
        >
          <p style={{ margin: 0, flex: 1 }}>{freezeError}</p>
          <button
            onClick={handleRetryFreeze}
            className="cl-primary-btn focus-ring"
            style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            data-testid="retry-freeze-btn"
          >
            Retry
          </button>
          <button
            onClick={() => {
              setFreezeError(null);
              setRetryLineId(null);
            }}
            className="banner-alert__close"
            aria-label="Dismiss freeze error"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            ✕
          </button>
        </div>
      )}
      {showCompare &&
        selectedCreditLines.length >= 2 &&
        selectedCreditLines.length <= MAX_COMPARE && (
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
          <div
            style={{
              width:
                selectedCreditLines.length > 2
                  ? "min(640px, 100%)"
                  : "min(480px, 100%)",
              height: "100%",
              position: "relative",
              zIndex: 1201,
            }}
          >
            <CompareLinesPanel
              lines={selectedCreditLines}
              onClose={handleCloseCompare}
            />
          </div>
        </div>
      )}

      <CreditLineList
        creditLines={creditLines}
        filteredAndSorted={filteredAndSorted}
        stablePage={stablePage}
        pageIndex={pageIndex}
        selectedLines={selectedLines}
        announcement={announcement}
        increaseStateByLine={increaseStateByLine}
        toggleSelection={toggleSelection}
        onSwapCollateral={handleSwapCollateral}
        onAdjustCollateral={handleAdjustCollateral}
        onRepay={handleRepay}
        onFreeze={handleFreeze}
        onUnfreeze={handleUnfreeze}
        onSchedule={handleSchedule}
        onDetails={handleDetails}
        onRequestLimitIncrease={handleOpenLimitIncrease}
        onClearFilters={() => setListParams({ status: "all", page: DEFAULT_PAGE })}
        onPreviousPage={() => setListParams({ page: Math.max(0, pageIndex - 1) })}
        onNextPage={() => setListParams({ page: Math.min(stablePage.pageCount - 1, pageIndex + 1) })}
      />

      {/* ── Repayment Schedule (Issue #428) ───────────────────────────────
       * Aggregate, chronological timeline of every past installment AND
       * forward-looking payment across the user's credit lines. Renders
       * only when at least one credit line has schedule-relevant data
       * (transactions or a configured next payment). Built from the
       * existing mock data via the pure `buildRepaymentScheduleFromLines`
       * helper so the timeline updates as the upstream state changes. */}
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

      {/* Collateral substitution modal — mounted at page level so it overlays everything */}
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

      {/* Collateral adjust modal (top up / withdraw) */}
      {adjustModalTarget && (
        <CollateralAdjustModal
          isOpen
          onClose={() => setAdjustModalTarget(null)}
          onSuccess={() => {
            setAdjustModalTarget(null);
            void refetch();
          }}
          creditLine={adjustModalTarget.line}
          triggerRef={adjustModalTarget.triggerRef}
        />
      )}

      {limitIncreaseTarget && (
        <LimitIncreaseModal
          line={limitIncreaseTarget.line}
          maxRequestable={limitIncreaseTarget.maxRequestable}
          triggerRef={limitIncreaseTarget.triggerRef}
          onClose={() => setLimitIncreaseTarget(null)}
          onSubmit={handleSubmitLimitIncrease}
        />
      )}

      {/* Lazy-loaded Credit Line Detail Drawer */}
      {selectedLine && (
        <Suspense fallback={null}>
          <CreditLineDetailDrawer
            line={selectedLine}
            onClose={handleCloseDetails}
            triggerRef={drawerTriggerRef}
          />
        </Suspense>
      )}
    </div>
  );
}

