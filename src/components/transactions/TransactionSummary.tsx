import { Amount } from "../Amount";
import type { CreditLine } from "../../types/creditLine";
import type { CreditTransaction } from "../../hooks/useCreditLines";
import { COLOR, fmt } from "../../utils/tokens";

interface TransactionSummaryProps {
  creditLines: CreditLine[];
  filteredTransactions: CreditTransaction[];
  selectedLine: string;
}

export function TransactionSummary({
  creditLines,
  filteredTransactions,
  selectedLine,
}: TransactionSummaryProps) {
  const outstandingBalance = creditLines
    .filter((line) => line.status !== "Closed")
    .reduce((sum, line) => sum + line.utilized, 0);
  const completedFiltered = filteredTransactions.filter(
    (tx) => tx.status === "Completed",
  );
  const totalDrawn = completedFiltered
    .filter((tx) => tx.type === "Draw")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalRepaid = completedFiltered
    .filter((tx) => tx.type === "Repay")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalInterestAndFees = completedFiltered
    .filter((tx) => tx.type === "Interest" || tx.type === "Fee")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const ledgerNet = totalDrawn - totalRepaid - totalInterestAndFees;

  return (
    <div className="th-stats">
      <div className="th-stat-card">
        <span
          className="th-stat-icon"
          style={{ background: "rgba(248,81,73,0.12)", color: COLOR.danger }}
        >
          💳
        </span>
        <div className="th-stat-content">
          <span className="th-stat-label">Outstanding Balance</span>
          <span
            className="th-stat-value num-tabular"
            style={{
              color: outstandingBalance > 0 ? COLOR.danger : COLOR.success,
            }}
          >
            <Amount
              value={outstandingBalance > 0 ? outstandingBalance : 0}
              format={fmt}
              maskedLabel="Outstanding balance hidden for privacy"
            />
          </span>
        </div>
      </div>

      <div className="th-stat-card">
        <span
          className="th-stat-icon"
          style={{ background: "rgba(88,166,255,0.12)", color: COLOR.accent }}
        >
          ↗
        </span>
        <div className="th-stat-content">
          <span className="th-stat-label">
            Total Drawn
            <span className="th-stat-scope"> in selected range</span>
          </span>
          <span
            className="th-stat-value num-tabular"
            style={{ color: COLOR.accent }}
          >
            <Amount value={totalDrawn} format={fmt} maskedLabel="Total drawn hidden for privacy" />
          </span>
        </div>
      </div>
      <div className="th-stat-card">
        <span
          className="th-stat-icon"
          style={{ background: "rgba(63,185,80,0.12)", color: COLOR.success }}
        >
          ↙
        </span>
        <div className="th-stat-content">
          <span className="th-stat-label">
            Total Repaid
            <span className="th-stat-scope"> in selected range</span>
          </span>
          <span
            className="th-stat-value num-tabular"
            style={{ color: COLOR.success }}
          >
            <Amount value={totalRepaid} format={fmt} maskedLabel="Total repaid hidden for privacy" />
          </span>
        </div>
      </div>
      <div className="th-stat-card">
        <span
          className="th-stat-icon"
          style={{
            background: "rgba(210,153,34,0.12)",
            color: COLOR.warning,
          }}
        >
          📈
        </span>
        <div className="th-stat-content">
          <span className="th-stat-label">
            Interest &amp; Fees
            <span className="th-stat-scope"> in selected range</span>
          </span>
          <span
            className="th-stat-value num-tabular"
            style={{ color: COLOR.warning }}
          >
            <Amount
              value={totalInterestAndFees}
              format={fmt}
              maskedLabel="Interest and fees hidden for privacy"
            />
          </span>
        </div>
      </div>

      {selectedLine !== "all" &&
        (() => {
          const line = creditLines.find((entry) => entry.id === selectedLine);
          if (!line) return null;
          const diff = ledgerNet - line.utilized;
          if (diff === 0) return null;
          const absDiff = Math.abs(diff);
          return (
            <div
              className="th-stat-card th-stat-card--reconciliation"
              title="The ledger net (draws − repays − fees/interest in the selected range) differs from the authoritative line balance. The gap is caused by transactions outside the selected date range, accrued interest, adjustments, or rounding."
            >
              <span
                className="th-stat-icon"
                style={{
                  background: "rgba(139,148,158,0.12)",
                  color: COLOR.muted,
                }}
              >
                ⚖
              </span>
              <div className="th-stat-content">
                <span className="th-stat-label">
                  Ledger net vs balance
                  <span className="th-stat-scope"> ⓘ</span>
                </span>
                <span
                  className="th-stat-value num-tabular"
                  style={{ color: COLOR.muted }}
                >
                  {diff > 0 ? "+" : "−"}
                  <Amount
                    value={absDiff}
                    format={fmt}
                    maskedLabel="Balance difference hidden for privacy"
                  />{" "}
                  <span style={{ fontSize: "0.75em" }}>difference</span>
                </span>
                <span className="th-stat-hint">
                  interest / fees / adjustments outside range
                </span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
