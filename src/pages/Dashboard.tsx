import { useMemo, useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import ActivityFeed from "../components/ActivityFeed";
import { CopyToClipboard } from "../components/CopyToClipboard";
import { CopyLoanButton } from "../components/CopyLoanButton";
import { StatusBadge } from "../components/StatusBadge";
import { AttestationCard } from "../components/AttestationCard";
import { CreditLineRowMenu } from "../components/CreditLineRowMenu";
import { KbdHint } from "../components/KbdHint";
import { DashboardTour } from "../components/DashboardTour";
import { useWallet } from "../context/WalletContext";
import { Sparkline } from "../components/Sparkline";
import { RiskBandsPanel } from "../components/RiskBandsPanel";
import { WhatsChangedPanel } from "../components/WhatsChangedPanel";
import { RiskExplainerOverlay } from "../components/RiskExplainerOverlay";
import { ContinuePrompt } from "../components/ContinuePrompt";
import { MOCK_CREDIT_LINES, MOCK_ATTESTATIONS } from "../data/mockData";
import type { Transaction } from "../types/creditLine";
import {
  COLOR,
  UTIL_COLOR,
  fmt,
  fmtDate,
  utilizationPct,
  getUtilizationLevel,
} from "../utils/tokens";
import "./Dashboard.css";
import "../styles/focus.css";
import { Skeleton } from "../components/Skeleton";
import { NoLines } from "../components/illustrations";
import { EmptyState } from "../components/EmptyState";
import { useInertBackdrop } from "../hooks/useInertBackdrop";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { WhatChanged } from "../components/WhatChanged";
import { RiskGauge } from "./RiskGauge";
import { LiveRegion } from "../components/LiveRegion";
import { useReducedMotion } from "../context/ReducedMotionContext";
import { HealthTipsPanel } from "../components/HealthTipsPanel";
import { SyncIndicator } from "@/components/SyncIndicator";
import { DashboardActionBar } from "../components/DashboardActionBar";

export { RiskGauge };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
};

const TX_ICON: Record<string, string> = {
  Draw: "↗",
  Repay: "↙",
  Fee: "📋",
  Interest: "📈",
};

const TX_COLOR: Record<string, string> = {
  Draw: COLOR.danger,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
};

// ─── Dashboard Component ──────────────────────────────────────────────────────

export function Dashboard() {
  // ── Reduced-motion fallback (Issue #500) ─────────────────────────────────
  // When the OS "Reduce Motion" setting is active, or the user has toggled the
  // in-app override, we strip all entrance-animation delays from card elements
  // so they appear instantly rather than staggering in.  The CSS already zeroes
  // out animation-duration and transition-duration via the @media rule in
  // Dashboard.css; this hook ensures the inline `animationDelay` style that
  // controls the stagger order is also removed.
  const { isReducedMotionActive } = useReducedMotion();

  /** Returns an empty object when reduced motion is active, otherwise the
   *  supplied style object.  Named after CSS's `animation-delay`. */
  const animDelay = (style: CSSProperties): CSSProperties =>
    isReducedMotionActive ? {} : style;

  const { wallet, status: walletStatus } = useWallet();
  const navigate = useNavigate();
  const creditLines = MOCK_CREDIT_LINES;

  const [repayCount, setRepayCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [announcement, setAnnouncement] = useState<string>('');
  const [isExplainOpen, setIsExplainOpen] = useState(false);

  // ─── Sync timestamps ─────────────────────────────────────────────────────
  const [riskSyncedAt, setRiskSyncedAt] = useState<Date>(() => new Date());
  const [creditSyncedAt, setCreditSyncedAt] = useState<Date>(() => new Date());
  const [activitySyncedAt, setActivitySyncedAt] = useState<Date>(() => new Date());

  const handleCreditRefresh = useCallback(async () => {
    await new Promise<void>((r) => setTimeout(r, 600));
    setCreditSyncedAt(new Date());
  }, []);

  const handleActivityRefresh = useCallback(async () => {
    await new Promise<void>((r) => setTimeout(r, 600));
    setActivitySyncedAt(new Date());
  }, []);
  // ─── Credit line row menu handlers ──────────────────────────────────────
  const handleRowRepay = useCallback(
    (lineId: string) => navigate(`/repay?line=${lineId}`),
    [navigate],
  );
  const handleRowDetails = useCallback(
    (lineId: string) => navigate(`/credit-lines?highlight=${lineId}`),
    [navigate],
  );
  const handleRowSchedule = useCallback(
    (lineId: string) => navigate(`/repayment-schedule?line=${lineId}`),
    [navigate],
  );

  const explainTriggerRef = useRef<HTMLButtonElement>(null);
  const [selectedCompareLines, setSelectedCompareLines] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const compareTriggerRef = useRef<HTMLButtonElement>(null);

  const handleOpenCompare = () => {
    if (selectedCompareLines.length === 2) {
      setShowCompare(true);
    }
  };

  const toggleCompareSelection = (id: string) => {
    setSelectedCompareLines((prev) => {
      if (prev.includes(id)) {
        return prev.filter((lineId) => lineId !== id);
      } else if (prev.length < 2) {
        return [...prev, id];
      }
      return prev;
    });
  };

  useInertBackdrop({ isInert: showCompare, modalId: "compare-lines-drawer-dashboard" });
  useBodyScrollLock({ isLocked: showCompare });


  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setStatus('loading');
      setAnnouncement('Loading dashboard data...');
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (isMounted) {
          setStatus('success');
          setAnnouncement('Dashboard loaded successfully.');
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setAnnouncement('Failed to load dashboard. Please try again.');
        }
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeLines = useMemo(
    () =>
      creditLines.filter(
        (cl) => cl.status === "Active" || cl.status === "Suspended",
      ),
    [creditLines, repayCount],
  );

  const activeLinesOnly = useMemo(
    () => creditLines.filter((cl) => cl.status === "Active"),
    [creditLines, repayCount],
  );


  const totalLimit = activeLinesOnly.reduce((s, cl) => s + cl.limit, 0);
  const totalUtilized = activeLinesOnly.reduce((s, cl) => s + cl.utilized, 0);
  const totalAvailable = totalLimit - totalUtilized;
  const overallPct = utilizationPct(totalUtilized, totalLimit || 1);
  const overallLevel =
    totalLimit > 0 ? getUtilizationLevel(totalUtilized, totalLimit) : "low";

  const avgRiskScore =
    activeLinesOnly.length > 0
      ? Math.round(
          activeLinesOnly.reduce((s, cl) => s + cl.riskScore, 0) /
            activeLinesOnly.length,
        )
      : 0;

  const recentActivity = useMemo(() => {
    const all: (Transaction & { lineName: string; lineId: string })[] = [];
    creditLines.forEach((cl) => {
      cl.transactions.forEach((tx) => {
        all.push({ ...tx, lineName: cl.name, lineId: cl.id });
      });
    });
    all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return all.slice(0, 5);
  }, [creditLines, repayCount]);


  const notifications = useMemo(() => {
    const notes: {
      icon: string;
      content: React.ReactNode;
      type: "info" | "warning" | "danger";
      time?: string;
    }[] = [];

    creditLines.forEach((cl) => {
      if (cl.status === "Suspended") {
        notes.push({
          icon: "⚠️",
          content: (
            <>
              <strong>{cl.name}</strong> has been suspended. Make a repayment to
              restore access.
            </>
          ),
          type: "warning",
          time: cl.updatedAt,
        });
      }
      if (cl.status === "Defaulted") {
        notes.push({
          icon: "🚨",
          content: (
            <>
              <strong>{cl.name}</strong> is in default (90+ days overdue).
              Contact support immediately.
            </>
          ),
          type: "danger",
          time: cl.updatedAt,
        });
      }
      if (cl.status === "Active") {
        const util = cl.utilized / cl.limit;
        if (util >= 0.75) {
          notes.push({
            icon: "📊",
            content: (
              <>
                <strong>{cl.name}</strong> utilization is at{" "}
                <span className="tabular-nums">{Math.round(util * 100)}</span>%. Consider a repayment.
              </>
            ),
            type: "warning",
          });
        }
        if (cl.nextPaymentDate) {
          const daysUntil = Math.ceil(
            (new Date(cl.nextPaymentDate).getTime() - Date.now()) / 86400000,
          );
          if (daysUntil > 0 && daysUntil <= 7) {
            notes.push({
              icon: "🗓️",
              content: (
                <>
                  Payment of <strong className="tabular-nums">{fmt(cl.nextPaymentAmount ?? 0)}</strong>{" "}
                  due in <span className="tabular-nums">{daysUntil}</span> day{daysUntil !== 1 ? "s" : ""} for{" "}
                  {cl.name}.
                </>
              ),
              type: "info",
            });
          }
        }
      }
    });
    return notes;
  }, [creditLines, repayCount]);


  const hasLines = creditLines.length > 0;
  const hasUtilized = totalUtilized > 0;
  const isConnected = walletStatus === "connected" && wallet;

  const truncAddr = wallet?.publicKey
    ? `${wallet.publicKey.slice(0, 6)}...${wallet.publicKey.slice(-4)}`
    : "";

  if (status === 'success' && !hasLines) {
    return (
      <>
        <LiveRegion 
          message={announcement} 
          aria-live={status === 'error' ? 'assertive' : 'polite'} 
        />
        <div className="dashboard-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              Dashboard
              <KbdHint keys={['Cmd', 'K']} separator="+" label="Command Palette" variant="badge" />
            </h1>
            <p className="subtitle">Your credit overview at a glance</p>
          </div>
          {isConnected && (
            <div className="wallet-info">
              <CopyToClipboard
                value={wallet.publicKey}
                displayValue={truncAddr}
                ariaLabel="Copy connected wallet address"
                variant="surface"
                className="wallet-address-chip"
                valueClassName="wallet-address-value"
              />
               <span
                 className={`network-badge ${wallet.network === "TESTNET" ? "testnet" : "mainnet"}`}
                 title={
                   wallet.network === "TESTNET"
                     ? "Testnet (no real funds)"
                     : "Mainnet (real funds)"
                 }
                 aria-label={
                   wallet.network === "TESTNET"
                     ? "Testnet network (test funds)"
                     : "Mainnet network (real funds)"
                 }
               >
                 <span className="dot" />
                 <span className="network-icon" aria-hidden="true">
                   {wallet.network === "TESTNET" ? "⚠️" : "✅"}
                 </span>
                 {wallet.network === "TESTNET" ? "Testnet" : "Mainnet"}
               </span>
            </div>
          )}
        </div>
        <EmptyState
          illustration={<NoLines className="empty-state-illustration--muted" />}
          title="No credit lines yet"
          description="Start your credit journey by requesting a credit evaluation. We'll analyze your on-chain activity to determine your credit limit and terms."
          primaryAction={{
            label: "Request Credit Evaluation",
            to: "/open-credit",
          }}
        />
      </>
    );
  }

  return (
    <div
      aria-busy={status === 'loading'}
      className="dashboard-root"
    >
      <LiveRegion 
        message={announcement} 
        aria-live={status === 'error' ? 'assertive' : 'polite'} 
      />

      <div className="dashboard-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            Dashboard
            <KbdHint keys={['Cmd', 'K']} separator="+" label="Command Palette" variant="badge" />
          </h1>
          <p className="subtitle">Your credit overview at a glance</p>
        </div>
        {isConnected && (
          <div className="wallet-info">
            <CopyToClipboard
              value={wallet.publicKey}
              displayValue={truncAddr}
              ariaLabel="Copy connected wallet address"
              variant="surface"
              className="wallet-address-chip"
              valueClassName="wallet-address-value"
            />
             <span
               className={`network-badge ${wallet.network === "TESTNET" ? "testnet" : "mainnet"}`}
               title={
                 wallet.network === "TESTNET"
                   ? "Testnet (no real funds)"
                   : "Mainnet (real funds)"
               }
               aria-label={
                 wallet.network === "TESTNET"
                   ? "Testnet network (test funds)"
                   : "Mainnet network (real funds)"
               }
             >
               <span className="dot" />
               <span className="network-icon" aria-hidden="true">
                 {wallet.network === "TESTNET" ? "⚠️" : "✅"}
               </span>
               {wallet.network === "TESTNET" ? "Testnet" : "Mainnet"}
             </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="summary-cards" data-tour-target="summaryCards" aria-busy={status === 'loading'}>
        {status === 'loading' ? (
          <>
            <div className="summary-card skeleton-card">
              <Skeleton
                style={{
                  width: "60%",
                  height: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{
                  width: "80%",
                  height: "var(--space-8)",
                  marginBottom: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{ width: "40%", height: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
              />
            </div>
            <div className="summary-card skeleton-card">
              <Skeleton
                style={{
                  width: "60%",
                  height: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{
                  width: "80%",
                  height: "var(--space-8)",
                  marginBottom: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{ width: "40%", height: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
              />
            </div>
            <div className="summary-card skeleton-card">
              <Skeleton
                style={{
                  width: "60%",
                  height: "var(--space-3)",
                  marginBottom: "var(--space-4)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{
                  width: "80%",
                  height: "var(--space-8)",
                  marginBottom: "var(--space-3)",
                  borderRadius: "var(--radius-sm)",
                }}
              />
              <Skeleton
                style={{ width: "40%", height: "var(--space-3)", borderRadius: "var(--radius-sm)" }}
              />
            </div>
          </>
        ) : (
          <>
            {/*
              v7 color-blind summary cards (closes #565):
              Each card carries a modifier class that drives the pattern
              stripe defined in src/styles/patterns.css.  Pattern alone
              (independent of colour) communicates card identity to a
              colour-blind user scanning the row.
            */}
            <div className="summary-card summary-card--accent">
              <div className="glow" style={{ background: COLOR.accent }} />
              <p className="label">
                Total Credit Limit
                <WhatChanged metricId="total-limit" currentValue={totalLimit} format="currency" label="Total Credit Limit" />
              </p>
              {/* num-tabular: prevents digit-width jitter as credit values change (FWC26) */}
              <p className="value num-tabular" style={{ color: COLOR.accent }}>
                {fmt(totalLimit)}
              </p>
              <p className="sub">
                Across {activeLinesOnly.length} active line
                {activeLinesOnly.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div
              className={`summary-card summary-card--util summary-card--util-${overallLevel}`}
            >
              <div
                className="glow"
                style={{ background: UTIL_COLOR[overallLevel] }}
              />
              <p className="label">
                Total Utilized
                <WhatChanged metricId="total-utilized" currentValue={totalUtilized} format="currency" label="Total Utilized" />
              </p>
              <p className="value num-tabular" style={{ color: UTIL_COLOR[overallLevel] }}>
                {fmt(totalUtilized)}
              </p>
              <p className="sub">{overallPct}% of total limit</p>
            </div>
            <div className="summary-card summary-card--available">
              <div className="glow" style={{ background: COLOR.success }} />
              <p className="label">
                Available Credit
                <WhatChanged metricId="available-credit" currentValue={totalAvailable} format="currency" label="Available Credit" />
              </p>
              <p className="value num-tabular" style={{ color: COLOR.success }}>
                {fmt(totalAvailable)}
              </p>
              <p className="sub">Ready to draw</p>
            </div>
          </>
        )}
      </div>

      {status === 'success' && <ActivityFeed />}

      {status === 'success' && hasLines && <ContinuePrompt creditLines={creditLines} />}

      <div className="dashboard-grid">
        <div>
          <div className="card" style={animDelay({ animationDelay: "0.1s" })}>
            <h2>
              <span className="icon">📊</span> Credit Summary
              {status === 'success' && (
                <SyncIndicator
                  lastSyncedAt={creditSyncedAt}
                  onRefresh={handleCreditRefresh}
                  className="sync-indicator--card-header"
                />
              )}
            </h2>
            <div className="util-bar-container">
              <div className="util-bar-header">
                <span style={{ color: COLOR.muted }}>Utilization</span>
                {/* num-tabular: stable percentage display (FWC26) */}
                <span
                  className="num-tabular"
                  style={{ fontWeight: "var(--font-semibold)", color: UTIL_COLOR[overallLevel] }}
                >
                  {overallPct}%
                </span>
              </div>
              <div className="util-bar-track">
                {/*
                  v7 color-blind util bar (closes #565):
                  `util-fill--{level}` modifier drives the diagonal-stripe
                  (medium) / cross-hatch (high) overlay rendered by
                  src/styles/patterns.css.  The inline `background` colour
                  is preserved underneath.
                */}
                <div
                  className={`util-bar-fill util-fill--${overallLevel}`}
                  style={{
                    width: `${overallPct}%`,
                    background: UTIL_COLOR[overallLevel],
                  }}
                />
              </div>
            </div>
            <div className="credit-breakdown">
              <div className="credit-breakdown-item">
                <p className="cb-label">Total Limit</p>
                {/* num-tabular: stable breakdown amounts (FWC26) */}
                <p className="cb-value num-tabular" style={{ color: COLOR.accent }}>
                  {fmt(totalLimit)}
                </p>
              </div>
              <div className="credit-breakdown-item">
                <p className="cb-label">Utilized</p>
                <p
                  className="cb-value num-tabular"
                  style={{ color: UTIL_COLOR[overallLevel] }}
                >
                  {fmt(totalUtilized)}
                </p>
              </div>
              <div className="credit-breakdown-item">
                <p className="cb-label">Available</p>
                <p className="cb-value num-tabular" style={{ color: COLOR.success }}>
                  {fmt(totalAvailable)}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Score */}
          <div className="card" data-tour-target="riskGauge" style={animDelay({ animationDelay: "0.15s" })} aria-busy={status === 'loading'}>
            <h2>
              <span className="icon">🛡️</span> Risk Score
              {status === 'success' && (
                <button
                  ref={explainTriggerRef}
                  type="button"
                  onClick={() => setIsExplainOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={isExplainOpen}
                  aria-label="Explain risk bands"
                  className="risk-explainer-trigger focus-ring"
                  data-testid="risk-explainer-trigger"
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-semibold)",
                    padding: "var(--space-1) var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    background: "transparent",
                    border: "1px solid var(--border, #30363d)",
                    color: "var(--muted, #8b949e)",
                    cursor: "pointer",
                    minHeight: "32px",
                  }}
                >
                  Explain
                </button>
              )}
            </h2>
            {status === 'loading' ? (
              <div className="risk-gauge-container">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100px', width: '160px', marginBottom: '0.75rem' }}>
                  <Skeleton style={{ width: '160px', height: '80px', borderRadius: '160px 160px 0 0' }} />
                </div>
                <div className="risk-meta" style={{ width: '100%' }}>
                  <div className="risk-meta-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                    {/* .rm-label — 0.65rem ≈ 10px cap height, block at 10px */}
                    <Skeleton width={40} height={10} shape="rounded" />
                    {/* .rm-value — 0.85rem ≈ 14px cap height, block at 14px */}
                    <Skeleton width={60} height={14} shape="rounded" />
                  </div>
                  <div className="risk-meta-item" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                    <Skeleton width={60} height={10} shape="rounded" />
                    <Skeleton width={50} height={14} shape="rounded" />
                  </div>
                </div>
              </div>
            ) : (
              <RiskGauge
                score={avgRiskScore}
                trend="improving"
                lastUpdated={activeLinesOnly[0]?.updatedAt ?? new Date().toISOString()}
              />
            )}
          </div>

          {status === 'success' && <AttestationCard attestations={MOCK_ATTESTATIONS} />}

           <div
             className="card"
             style={animDelay({ animationDelay: "0.2s" })}
             aria-busy={status === 'loading'}
           >
             <h2>
               <span className="icon">💳</span> Active Credit Lines
               {status === 'success' && (
                 <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                   {activeLines.length >= 2 && (
                     <button
                       ref={compareTriggerRef}
                       type="button"
                       onClick={handleOpenCompare}
                       disabled={selectedCompareLines.length !== 2}
                       className="focus-ring"
                       style={{
                         padding: "var(--space-1) var(--space-3)",
                         fontSize: "var(--text-xs)",
                         fontWeight: "var(--font-semibold)",
                         borderRadius: "var(--radius-sm)",
                         background: selectedCompareLines.length === 2 ? "var(--accent)" : "rgba(139,148,158,0.12)",
                         color: selectedCompareLines.length === 2 ? "#0d1117" : "var(--muted)",
                         border: "none",
                         cursor: selectedCompareLines.length === 2 ? "pointer" : "not-allowed",
                         opacity: selectedCompareLines.length === 2 ? 1 : 0.6,
                         transition: "all 0.15s",
                       }}
                     >
                       Compare Selected ({selectedCompareLines.length}/2)
                     </button>
                   )}
                   <span
                     style={{
                       fontSize: "var(--text-xs)",
                       fontWeight: 400,
                       color: COLOR.muted,
                     }}
                   >
                     {activeLines.length} line{activeLines.length !== 1 ? "s" : ""}
                   </span>
                 </div>
               )}
             </h2>
             {status === 'loading' ? (
               <>
                 <div className="cl-preview-item" aria-hidden="true">
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div
                       style={{
                         display: "flex",
                         alignItems: "center",
                         gap: "var(--space-2)",
                         marginBottom: "var(--space-1)",
                       }}
                     >
                       <Skeleton
                         style={{
                           width: "100px",
                           height: "var(--space-3)",
                           borderRadius: "2px",
                         }}
                       />
                       <Skeleton
                         style={{
                           width: "50px",
                           height: "var(--space-3)",
                           borderRadius: "var(--radius-sm)",
                         }}
                       />
                     </div>
                     {/* .cl-preview-id — 0.7rem mono / 11px, block at 10px */}
                     <Skeleton width={120} height={10} shape="rounded" />
                   </div>
                   <div
                     className="cl-preview-right"
                     style={{
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "flex-end",
                       gap: "var(--space-1)",
                     }}
                   >
                     <Skeleton
                       style={{
                         width: "80px",
                         height: "var(--space-3)",
                         borderRadius: "2px",
                       }}
                     />
                     <Skeleton
                       style={{
                         width: "60px",
                         height: "6px",
                         borderRadius: "2px",
                       }}
                     />
                   </div>
                 </div>
                 <div className="cl-preview-item" aria-hidden="true">
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div
                       style={{
                         display: "flex",
                         alignItems: "center",
                         gap: "var(--space-2)",
                         marginBottom: "var(--space-1)",
                       }}
                     >
                       <Skeleton
                         style={{
                           width: "80px",
                           height: "var(--space-3)",
                           borderRadius: "2px",
                         }}
                       />
                       <Skeleton
                         style={{
                           width: "50px",
                           height: "var(--space-3)",
                           borderRadius: "var(--radius-sm)",
                         }}
                       />
                     </div>
                     <Skeleton width={100} height={10} shape="rounded" />
                   </div>
                   <div
                     className="cl-preview-right"
                     style={{
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "flex-end",
                       gap: "var(--space-1)",
                     }}
                   >
                     <Skeleton
                       style={{
                         width: "70px",
                         height: "var(--space-3)",
                         borderRadius: "2px",
                       }}
                     />
                     <Skeleton
                       style={{
                         width: "50px",
                         height: "6px",
                         borderRadius: "2px",
                       }}
                     />
                   </div>
                 </div>
                 <div className="cl-preview-item" aria-hidden="true">
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <div
                       style={{
                         display: "flex",
                         alignItems: "center",
                         gap: "var(--space-2)",
                         marginBottom: "var(--space-1)",
                       }}
                     >
                       <Skeleton
                         style={{
                           width: "90px",
                           height: "var(--space-3)",
                           borderRadius: "2px",
                         }}
                       />
                       <Skeleton
                         style={{
                           width: "50px",
                           height: "var(--space-3)",
                           borderRadius: "var(--radius-sm)",
                         }}
                       />
                     </div>
                     <Skeleton width={110} height={10} shape="rounded" />
                   </div>
                   <div
                     className="cl-preview-right"
                     style={{
                       display: "flex",
                       flexDirection: "column",
                       alignItems: "flex-end",
                       gap: "var(--space-1)",
                     }}
                   >
                     <Skeleton
                       style={{
                         width: "60px",
                         height: "var(--space-3)",
                         borderRadius: "2px",
                       }}
                     />
                     <Skeleton
                       style={{
                         width: "40px",
                         height: "6px",
                         borderRadius: "2px",
                       }}
                     />
                   </div>
                 </div>
               </>
             ) : (
               <>
                 {activeLines.slice(0, 3).map((cl) => {
                   const pct = utilizationPct(cl.utilized, cl.limit);
                   const level = getUtilizationLevel(cl.utilized, cl.limit);
                   const isSelected = selectedCompareLines.includes(cl.id);
                   return (
                     <div key={cl.id} className="cl-preview-item">
                       {activeLines.length >= 2 && (
                         <div style={{ paddingRight: "0.75rem", display: "flex", alignItems: "center" }}>
                           <label
                             className="cl-row-select"
                             style={{
                               margin: 0,
                               display: "inline-flex",
                               alignItems: "center",
                               justifyContent: "center",
                               cursor: "pointer",
                               minWidth: "44px",
                               minHeight: "44px",
                             }}
                           >
                             <input
                               type="checkbox"
                               checked={isSelected}
                               onChange={() => toggleCompareSelection(cl.id)}
                               aria-label={`Select ${cl.name} for comparison`}
                               style={{
                                 cursor: "pointer",
                                 width: "16px",
                                 height: "16px",
                                 accentColor: "var(--accent)",
                               }}
                             />
                           </label>
                         </div>
                       )}
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "0.2rem" }}>
                           <p className="cl-preview-name">{cl.name}</p>
                           <StatusBadge status={cl.status} />
                         </div>
                         <p className="cl-preview-id">{cl.id}</p>
                       </div>
                       <div className="cl-preview-right">
                         {/* num-tabular: stable utilized/limit amounts (FWC26) */}
                         <div className="cl-preview-amount num-tabular">
                           {fmt(cl.utilized)} <span style={{ color: COLOR.muted, fontWeight: 400, fontSize: "var(--text-xs)" }}>/ {fmt(cl.limit)}</span>
                         </div>
                         <div className="cl-preview-bar">
                           <div className="cl-preview-bar-fill" style={{ width: `${pct}%`, background: UTIL_COLOR[level] }} />
                         </div>
                       </div>
                       <CreditLineRowMenu
                         lineId={cl.id}
                         lineName={cl.name}
                         onRepay={() => handleRowRepay(cl.id)}
                         onSchedule={handleRowSchedule}
                         onDetails={handleRowDetails}
                       />
                     </div>
                   );
                 })}
                 <Link to="/credit-lines" className="view-all-link">
                   View all credit lines →
                 </Link>
               </>
             )}
           </div>
         </div>
 
         <div>
           <div className="card" style={animDelay({ animationDelay: "0.12s" })}>
             <h2><span className="icon">⚡</span> Quick Actions</h2>
             <div className="quick-actions-grid">
               {!hasLines && (
                 <button
                   className="qa-btn"
                   style={{ borderColor: "rgba(88,166,255,0.3)" }}
                 >
                   <div className="qa-icon" style={{ background: "rgba(88,166,255,0.12)", color: COLOR.accent }}>🆕</div>
                   <div>
                     <div className="qa-label" style={{ color: COLOR.accent }}>Open Credit Line</div>
                     <div className="qa-desc" style={{ color: COLOR.muted }}>Get started with your first line</div>
                   </div>
                   <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                 </button>
               )}
               {hasLines && activeLinesOnly.length > 0 && (
                 <button
                   className="qa-btn"
                   style={{ borderColor: "rgba(88,166,255,0.3)" }}
                 >
                   <div className="qa-icon" style={{ background: "rgba(88,166,255,0.12)", color: COLOR.accent }}>↗</div>
                   <div>
                     <div className="qa-label" style={{ color: COLOR.accent }}>Draw Credit</div>
                     <div className="qa-desc num-tabular" style={{ color: COLOR.muted }}>{fmt(totalAvailable)} available</div>
                   </div>
                   <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                 </button>
               )}
               {hasUtilized && (
                 <button
                   className="qa-btn"
                   style={{ borderColor: "rgba(63,185,80,0.3)" }}
                 >
                   <div className="qa-icon" style={{ background: "rgba(63,185,80,0.12)", color: COLOR.success }}>↙</div>
                   <div>
                     <div className="qa-label" style={{ color: COLOR.success }}>Repay Credit</div>
                     <div className="qa-desc num-tabular" style={{ color: COLOR.muted }}>{fmt(totalUtilized)} outstanding</div>
                   </div>
                   <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
                 </button>
               )}
               <Link
                 to="/credit-lines"
                 className="qa-btn"
                 style={{ borderColor: "transparent", textDecoration: "none" }}
               >
                 <div className="qa-icon" style={{ background: "rgba(139,148,158,0.12)", color: COLOR.muted }}>📋</div>
                 <div>
                   <div className="qa-label" style={{ color: COLOR.text }}>View Credit Lines</div>
                   <div className="qa-desc" style={{ color: COLOR.muted }}>Manage all your credit lines</div>
                 </div>
                 <span className="qa-arrow" style={{ color: COLOR.muted }}>→</span>
               </Link>
                {hasLines && (
                  <CopyLoanButton creditLines={creditLines} />
                )}
             </div>
           </div>
 
           <div className="card" style={animDelay({ animationDelay: "0.18s" })} aria-busy={status === 'loading'}>
             <h2>
               <span className="icon">📝</span> Recent Activity
               {status === 'success' && (
                 <SyncIndicator
                   lastSyncedAt={activitySyncedAt}
                   onRefresh={handleActivityRefresh}
                   className="sync-indicator--card-header"
                 />
               )}
             </h2>
             {status === 'loading' ? (
               <>
                 <div className="activity-item">
                   <Skeleton className="activity-icon" style={{ borderRadius: "6px" }} />
                   <div className="activity-content" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                     <Skeleton style={{ width: "120px", height: "var(--space-3)", borderRadius: "2px" }} />
                     <Skeleton style={{ width: "180px", height: "10px", borderRadius: "2px" }} />
                   </div>
                   <Skeleton style={{ width: "60px", height: "var(--space-3)", marginLeft: "auto", borderRadius: "2px" }} />
                 </div>
                 <div className="activity-item">
                   <Skeleton className="activity-icon" style={{ borderRadius: "6px" }} />
                   <div className="activity-content" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                     <Skeleton style={{ width: "100px", height: "var(--space-3)", borderRadius: "2px" }} />
                     <Skeleton style={{ width: "150px", height: "10px", borderRadius: "2px" }} />
                   </div>
                   <Skeleton style={{ width: "50px", height: "var(--space-3)", marginLeft: "auto", borderRadius: "2px" }} />
                 </div>
                 <div className="activity-item">
                   <Skeleton className="activity-icon" style={{ borderRadius: "6px" }} />
                   <div className="activity-content" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                     <Skeleton style={{ width: "140px", height: "var(--space-3)", borderRadius: "2px" }} />
                     <Skeleton style={{ width: "160px", height: "10px", borderRadius: "2px" }} />
                   </div>
                   <Skeleton style={{ width: "70px", height: "var(--space-3)", marginLeft: "auto", borderRadius: "2px" }} />
                 </div>
               </>
             ) : recentActivity.length === 0 ? (
               <p style={{ color: COLOR.muted, fontSize: "0.8rem", textAlign: "center", padding: "1.5rem 0" }}>
                 No transactions yet
               </p>
             ) : (
               recentActivity.map((tx, i) => (
                 <div key={`${tx.id}-${i}`} className="activity-item">
                   <div
                     className="activity-icon"
                     style={{
                       background: `${TX_COLOR[tx.type]}15`,
                       color: TX_COLOR[tx.type],
                     }}
                   >
                     {TX_ICON[tx.type]}
                   </div>
                   <div className="activity-content">
                     <div className="activity-title">{tx.note || tx.type}</div>
                     <div className="activity-sub">{tx.lineName} · {relativeTime(tx.date)}</div>
                   </div>
                   {/* num-tabular: stable transaction amounts (FWC26) */}
                   <div className="activity-amount num-tabular" style={{ color: TX_COLOR[tx.type] }}>
                     {tx.type === "Repay" ? "+" : "-"}{fmt(tx.amount)}
                   </div>
                 </div>
               ))
             )}
           </div>
 
           {notifications.length > 0 && (
             <div className="card" style={animDelay({ animationDelay: "0.22s" })}>
               <h2><span className="icon">🔔</span> Alerts</h2>
               {notifications.map((note, i) => (
                 <div 
                   key={i} 
                   className={`notification-item notification-item--${note.type}`}
                   role={note.type === "danger" ? "alert" : "status"}
                 >
                   <span className="notification-icon" aria-hidden="true">{note.icon}</span>
                   <div>
                     <div className="notification-text">
                       {note.content}
                     </div>
                     {note.time && (
                       <div className="notification-time">{relativeTime(note.time)}</div>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>

        {/* Health Tips panel (preserved from orphan block; v7 keeps dashboard tree single-column inside grid) */}
        <HealthTipsPanel />
       </div>

      <DashboardTour />
      {/* Centered risk-band explainer overlay (#426).  Triggered by the
          "Explain risk bands" button rendered next to the risk gauge
          header.  The component manages its own focus trap, body scroll
          lock, and inert backdrop. */}
      <RiskExplainerOverlay
        isOpen={isExplainOpen}
        onClose={() => setIsExplainOpen(false)}
        triggerRef={explainTriggerRef}
      />

      {/* Sticky action bar — appears on scroll with primary actions */}
      <DashboardActionBar
        hasLines={hasLines}
        hasUtilized={hasUtilized}
        activeLinesOnly={activeLinesOnly}
        totalAvailable={totalAvailable}
        totalUtilized={totalUtilized}
        creditLines={creditLines}
      />
    </div>
  );
}