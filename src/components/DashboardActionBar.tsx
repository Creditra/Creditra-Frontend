import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "../context/ReducedMotionContext";
import { CopyLoanButton } from "./CopyLoanButton";
import type { CreditLine } from "../types/creditLine";

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardActionBarProps {
  hasLines: boolean;
  hasUtilized: boolean;
  activeLinesOnly: CreditLine[];
  totalAvailable: number;
  totalUtilized: number;
  /** Offset from the top of the document (pixels) before the bar appears. */
  scrollThreshold?: number;
  /** All credit lines (passed through to CopyLoanButton). */
  creditLines: CreditLine[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardActionBar({
  hasLines,
  hasUtilized,
  activeLinesOnly,
  totalAvailable,
  totalUtilized,
  scrollThreshold = 300,
  creditLines,
}: DashboardActionBarProps) {
  const [visible, setVisible] = useState(false);
  const { isReducedMotionActive } = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > scrollThreshold);
    };

    // Check initial state
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollThreshold]);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label="Quick actions"
      className={`dashboard-action-bar${visible ? " dashboard-action-bar--visible" : ""}${
        isReducedMotionActive ? " dashboard-action-bar--no-motion" : ""
      }`}
      data-visible={visible}
      hidden={!visible}
    >
      <div className="dashboard-action-bar__inner">
        {!hasLines && (
          <Link
            to="/open-credit"
            className="dashboard-action-bar__btn dashboard-action-bar__btn--primary"
          >
            <span aria-hidden="true">🆕</span>
            <span className="dashboard-action-bar__label">Open Credit Line</span>
          </Link>
        )}

        {hasLines && activeLinesOnly.length > 0 && (
          <Link
            to="/draw"
            className="dashboard-action-bar__btn dashboard-action-bar__btn--primary"
          >
            <span aria-hidden="true">↗</span>
            <span className="dashboard-action-bar__label">Draw Credit</span>
            <span className="dashboard-action-bar__meta num-tabular">
              {fmt(totalAvailable)}
            </span>
          </Link>
        )}

        {hasUtilized && (
          <Link
            to="/repay"
            className="dashboard-action-bar__btn dashboard-action-bar__btn--secondary"
          >
            <span aria-hidden="true">↙</span>
            <span className="dashboard-action-bar__label">Repay</span>
            <span className="dashboard-action-bar__meta num-tabular">
              {fmt(totalUtilized)}
            </span>
          </Link>
        )}

        <Link
          to="/credit-lines"
          className="dashboard-action-bar__btn dashboard-action-bar__btn--tertiary"
        >
          <span aria-hidden="true">📋</span>
          <span className="dashboard-action-bar__label">View Credit Lines</span>
        </Link>

        {hasLines && (
          <CopyLoanButton creditLines={creditLines} />
        )}
      </div>
    </div>
  );
}

export default DashboardActionBar;