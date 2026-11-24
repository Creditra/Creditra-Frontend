import React, { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import { Amount } from "../Amount";
import { CopyToClipboard } from "../CopyToClipboard";
import { copyTextToClipboard } from "../../utils/clipboard";
import { getExplorerBaseUrl } from "../../utils/wallet";
import { getCreditNetworkConfig } from "../../config/creditNetwork";
import { fmt, fmtDateTime, COLOR } from "../../utils/tokens";
import { relativeTime } from "./transactionPresentation";
import type { TransactionStatus, TransactionType } from "../../types/creditLine";
import type { CreditTransaction } from "../../hooks/useCreditLines";

export type TransactionWithLine = CreditTransaction;
export const TX_TYPE_LABELS: Record<TransactionType, string> = {
  Draw: "Draw",
  Repay: "Repayment",
  Fee: "Fee",
  Interest: "Interest",
  StatusChange: "Status Change",
};

const TX_TYPE_ICONS: Record<TransactionType, string> = {
  Draw: "↗",
  Repay: "↙",
  Fee: "📋",
  Interest: "📈",
  StatusChange: "🔄",
};

const TX_TYPE_COLORS: Record<TransactionType, string> = {
  Draw: COLOR.accent,
  Repay: COLOR.success,
  Fee: COLOR.muted,
  Interest: COLOR.warning,
  StatusChange: "#d29922",
};

const STATUS_COLORS: Record<TransactionStatus, { bg: string; color: string }> =
  {
    Completed: { bg: "rgba(63,185,80,0.15)", color: COLOR.success },
    Pending: { bg: "rgba(210,153,34,0.15)", color: COLOR.warning },
    Failed: { bg: "rgba(248,81,73,0.15)", color: COLOR.danger },
  };

/**
 * CSS pattern classes for each transaction status.
 *
 * These classes add a pure-CSS geometric pattern on top of the coloured
 * background so that the three statuses are distinguishable without
 * relying on colour alone (WCAG 2.1 SC 1.4.1 — Use of Color).
 *
 * The classes are defined in src/styles/patterns.css and are globally
 * available via index.css.
 */
const STATUS_PATTERNS: Record<TransactionStatus, string> = {
  Completed: "tx-status-pattern--completed",
  Pending: "tx-status-pattern--pending",
  Failed: "tx-status-pattern--failed",
};

function getExplorerUrl(txHash: string): string {
  let network = "PUBLIC";
  try {
    network = getCreditNetworkConfig().network;
  } catch {
    // ConfigError on bad env — fall back to PUBLIC
  }
  return `${getExplorerBaseUrl(network)}/${encodeURIComponent(txHash)}`;
}

function TransactionHashMenu({ txHash }: { txHash: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleCopy() {
    await copyTextToClipboard(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  }

  return (
    <div
      className="tx-hash-menu-wrapper"
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="tx-hash-truncated">
        {txHash.slice(0, 8)}...{txHash.slice(-6)}
      </span>
      <button
        ref={triggerRef}
        className="tx-hash-menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Transaction actions"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          className="tx-hash-menu"
          role="menu"
          aria-orientation="vertical"
          aria-label="Transaction hash actions"
        >
          <button
            role="menuitem"
            className="tx-hash-menu-item"
            onClick={handleCopy}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCopy(); }
            }}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
            {copied ? "Copied!" : "Copy transaction hash"}
          </button>
          <a
            role="menuitem"
            className="tx-hash-menu-item"
            href={getExplorerUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            View on explorer
          </a>
        </div>
      )}
      {copied && (
        <span role="status" aria-live="polite" className="sr-only">
          Copied
        </span>
      )}
    </div>
  );
}

export function TransactionRow({
  tx,
  expanded,
  onToggle,
  ariaRowIndex,
  tabIndex,
  rowRef,
  onFocus,
  onKeyDown,
}: {
  tx: TransactionWithLine;
  expanded: boolean;
  onToggle: () => void;
  ariaRowIndex?: number;
  tabIndex?: number;
  rowRef?: (el: HTMLTableRowElement | null) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTableRowElement>) => void;
}) {
  const isNegative = tx.type === "Repay" || tx.type === "Fee";

  return (
    <>
      <tr
        ref={rowRef}
        className={`tx-row ${expanded ? "expanded" : ""}`}
        aria-rowindex={ariaRowIndex}
        aria-expanded={expanded}
        tabIndex={tabIndex}
        onClick={onToggle}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      >
        <td className="tx-date">
          <div className="tx-date-main">{relativeTime(tx.date)}</div>
          <div className="tx-date-sub">
            {new Date(tx.date).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </td>
        <td className="tx-type">
          <span
            className="tx-type-badge"
            style={{
              background: `${TX_TYPE_COLORS[tx.type]}15`,
              color: TX_TYPE_COLORS[tx.type],
            }}
          >
            <span className="tx-type-icon">{TX_TYPE_ICONS[tx.type]}</span>
            {TX_TYPE_LABELS[tx.type]}
          </span>
        </td>
        <td
          className="tx-amount num-tabular"
          style={{
            color: isNegative
              ? COLOR.success
              : tx.type === "Draw"
                ? COLOR.accent
                : COLOR.text,
          }}
        >
          {isNegative ? "-" : tx.type === "Draw" ? "+" : ""}
          {isNegative || tx.amount > 0 ? (
            <Amount value={tx.amount} format={fmt} maskedLabel="Transaction amount hidden for privacy" />
          ) : null}
        </td>
        <td className="tx-line">
          <span className="tx-line-name">{tx.lineName}</span>
          <span className="tx-line-id">{tx.lineId}</span>
        </td>
        <td className="tx-status">
          <span
            className={`tx-status-badge ${STATUS_PATTERNS[tx.status]}`}
            style={{
              background: STATUS_COLORS[tx.status].bg,
              color: STATUS_COLORS[tx.status].color,
            }}
          >
            {tx.status}
          </span>
        </td>
        <td className="tx-hash">
          {tx.txHash ? (
            <TransactionHashMenu txHash={tx.txHash} />
          ) : (
            <span className="tx-hash-muted">—</span>
          )}
        </td>
        <td className="tx-expand">
          <span className={`expand-icon ${expanded ? "rotated" : ""}`}>▾</span>
        </td>
      </tr>
      {expanded && (
        <tr className="tx-detail-row">
          <td colSpan={7}>
            <div className="tx-detail">
              <div className="tx-detail-section">
                <h4>Transaction Details</h4>
                <div className="tx-detail-grid">
                  <div className="tx-detail-item">
                    <span className="label">Transaction ID</span>
                    <span className="value">{tx.id}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Date & Time</span>
                    <span className="value">{fmtDateTime(tx.date)}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Type</span>
                    <span className="value">{TX_TYPE_LABELS[tx.type]}</span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Amount</span>
                    <span
                      className="value num-tabular"
                      style={{
                        color: isNegative ? COLOR.success : COLOR.accent,
                      }}
                    >
                      {isNegative ? "-" : "+"}
                      <Amount value={tx.amount} format={fmt} maskedLabel="Transaction amount hidden for privacy" />
                    </span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Status</span>
                    <span
                      className="value"
                      style={{ color: STATUS_COLORS[tx.status].color }}
                    >
                      {tx.status}
                    </span>
                  </div>
                  <div className="tx-detail-item">
                    <span className="label">Credit Line</span>
                    <span className="value">
                      {tx.lineName} ({tx.lineId})
                    </span>
                  </div>
                  {tx.note && (
                    <div className="tx-detail-item full-width">
                      <span className="label">Note</span>
                      <span className="value">{tx.note}</span>
                    </div>
                  )}
                  {tx.txHash && (
                    <div className="tx-detail-item full-width">
                      <span className="label">Transaction Hash</span>
                      <div className="value tx-detail-hash">
                        <a
                          href={getExplorerUrl(tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="tx-hash-full"
                        >
                          {tx.txHash}
                        </a>
                        <CopyToClipboard
                          value={tx.txHash}
                          ariaLabel={`Copy full transaction hash for ${tx.id}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
