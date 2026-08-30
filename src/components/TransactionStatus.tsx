import { Transaction } from "@/types/draw-credit.types";
import { CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import "@/styles/patterns.css";

interface TransactionStatusProps {
  transaction: Transaction;
  onNewDraw: () => void;
  onRefresh?: () => void;
}

const STATUS_CONFIG = {
  pending: {
    Icon: Clock,
    title: "Processing",
    colorMod: "accent",
    patternMod: "pending",
    message: "Your draw request is being processed.",
  },
  success: {
    Icon: CheckCircle2,
    title: "Draw Successful",
    colorMod: "success",
    patternMod: "success",
    message: "Funds have been disbursed to your account.",
  },
  error: {
    Icon: AlertCircle,
    title: "Draw Failed",
    colorMod: "error",
    patternMod: "error",
    message: null,
  },
  stale: {
    Icon: Clock,
    title: "Status Unknown",
    colorMod: "accent",
    patternMod: "pending",
    message: "The transaction status is unclear. Please refresh to check again.",
  },
} as const;

export function TransactionStatus({
  transaction,
  onNewDraw,
  onRefresh,
}: TransactionStatusProps) {
  const config = STATUS_CONFIG[transaction.status];
  const { Icon, title, colorMod, patternMod } = config;

  const message =
    transaction.status === "error"
      ? (transaction.message ?? "An error occurred during processing.")
      : config.message;

  return (
    <div
      className="dc-spinner-wrap"
      role="status"
      aria-live="polite"
    >
      <div className="dc-status-icon-wrap" style={{ display: "flex", justifyContent: "center" }}>
        <div
          className={`dc-status-icon-bg dc-status-icon-bg--${colorMod} dc-status-icon-bg--pattern-${patternMod}`}
          data-status={transaction.status}
        >
          <Icon
            className={`dc-status-icon dc-status-icon--${colorMod}`}
            aria-hidden="true"
          />
        </div>
      </div>

      <div>
        <h2 className="dc-step__title">{title}</h2>
        <p className="dc-step__subtitle">{message}</p>
      </div>

      <div className="dc-status-detail-card">
        <div className="dc-status-detail-row">
          <p className="dc-status-detail-row__label">Transaction ID</p>
          <p className="dc-status-detail-row__value dc-status-detail-row__value--mono">
            {transaction.id}
          </p>
        </div>
        <div className="dc-status-detail-row">
          <p className="dc-status-detail-row__label">Amount Drawn</p>
          <p className="dc-status-detail-row__value dc-status-detail-row__value--large tabular-nums">
            ${transaction.amount.toLocaleString()}
          </p>
        </div>
        {transaction.timestamp && (
          <div className="dc-status-detail-row">
            <p className="dc-status-detail-row__label">Time</p>
            <p className="dc-status-detail-row__value">
              {transaction.timestamp.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {transaction.status === "success" && (
        <div className="dc-success-notice">
          <p>Funds will be deposited to your account within 1-2 business days.</p>
        </div>
      )}

      {transaction.status === "stale" && onRefresh && (
        <button
          onClick={onRefresh}
          className="dc-btn dc-btn--primary dc-btn--full dc-btn--icon-gap"
          style={{ marginBottom: '12px' }}
        >
          <RotateCcw width={20} height={20} aria-hidden="true" />
          Refresh Status
        </button>
      )}

      <button
        onClick={onNewDraw}
        className={`dc-btn dc-btn--full dc-btn--icon-gap ${transaction.status === "stale" ? "" : "dc-btn--primary"}`}
      >
        <RotateCcw width={20} height={20} aria-hidden="true" />
        Make Another Draw
      </button>
    </div>
  );
}
