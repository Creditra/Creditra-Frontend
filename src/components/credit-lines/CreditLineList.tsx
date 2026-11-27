import { Link } from "react-router-dom";
import { NoLines } from "../illustrations";
import { LiveRegion } from "../LiveRegion";
import { CreditLineCard } from "./CreditLineCard";
import type { ComponentProps, RefObject } from "react";
import type { CreditLine } from "../../types/creditLine";

export interface StableCreditLinePage {
  items: CreditLine[];
  pageIndex: number;
  pageCount: number;
}

export interface CreditLineListProps {
  creditLines: CreditLine[];
  filteredAndSorted: CreditLine[];
  stablePage: StableCreditLinePage;
  pageIndex: number;
  selectedLines: string[];
  announcement?: string;
  increaseStateByLine: Map<string, { disabledReasons: string[]; increasePending: boolean }>;
  toggleSelection: (lineId: string) => void;
  onSwapCollateral?: ComponentProps<typeof CreditLineCard>["onSwapCollateral"];
  onAdjustCollateral?: ComponentProps<typeof CreditLineCard>["onAdjustCollateral"];
  onRepay: (lineId: string) => void;
  onFreeze: (lineId: string) => void;
  onUnfreeze: (lineId: string) => void;
  onSchedule: (lineId: string) => void;
  onDetails: (lineId: string, triggerRef: RefObject<HTMLButtonElement | null>) => void;
  onRequestLimitIncrease: ComponentProps<typeof CreditLineCard>["onRequestLimitIncrease"];
  onClearFilters: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function CreditLineList(props: CreditLineListProps) {
  const {
    creditLines,
    filteredAndSorted,
    stablePage,
    selectedLines,
    announcement = "",
    increaseStateByLine,
    toggleSelection,
    onSwapCollateral,
    onAdjustCollateral,
    onRepay,
    onFreeze,
    onUnfreeze,
    onSchedule,
    onDetails,
    onRequestLimitIncrease,
    onClearFilters,
    onPreviousPage,
    onNextPage,
  } = props;

  return (
    <>
      <LiveRegion message={announcement} id="cl-live-region" />
      <div role="status" aria-live="polite" aria-busy={false}>
        {filteredAndSorted.length === 0 ? (
          creditLines.length > 0 ? (
            <div className="cl-empty" role="region" aria-label="No matching credit lines">
              <NoLines className="empty-state-illustration--muted" />
              <h2 className="cl-empty-title">No matching credit lines</h2>
              <p className="cl-empty-desc">Try changing the status filter to see your credit lines.</p>
              <button type="button" className="cl-primary-btn focus-ring" onClick={onClearFilters}>Clear Filters</button>
            </div>
          ) : (
            <div className="cl-empty" role="region" aria-label="No credit lines">
              <NoLines className="empty-state-illustration--muted" />
              <h2 className="cl-empty-title">Get started with Credit Lines</h2>
              <p className="cl-empty-desc">Credit lines give you access to flexible capital when you need it. Open your first line and unlock funding tailored to your business.</p>
              <ul className="cl-empty-features">
                <li>Flexible funding up to $500K</li>
                <li>Competitive rates from 7.5% APR</li>
                <li>Quick approval with digital collateral</li>
              </ul>
              <Link to="/open-credit" className="cl-primary-btn focus-ring">Open Credit Line</Link>
            </div>
          )
        ) : (
          <>
            {stablePage.items.length > 0 ? (
              <div className="cl-grid" data-testid="cl-grid">
                {stablePage.items.map((line) => (
                  <CreditLineCard
                    key={line.id}
                    line={line}
                    isSelected={selectedLines.includes(line.id)}
                    onToggle={toggleSelection}
                    onSwapCollateral={onSwapCollateral}
                    onAdjustCollateral={onAdjustCollateral}
                    onRepay={() => onRepay(line.id)}
                    onFreeze={onFreeze}
                    onUnfreeze={onUnfreeze}
                    onSchedule={onSchedule}
                    onDetails={onDetails}
                    limitIncreaseDisabledReasons={increaseStateByLine.get(line.id)?.disabledReasons ?? ["Eligibility could not be determined."]}
                    increasePending={increaseStateByLine.get(line.id)?.increasePending ?? false}
                    onRequestLimitIncrease={onRequestLimitIncrease}
                  />
                ))}
              </div>
            ) : (
              <p role="status" style={{ color: "var(--muted)", margin: "1rem 0" }}>
                No current records on this page. Page positions are being held stable while live updates settle.
              </p>
            )}

            {stablePage.pageCount > 1 && (
              <nav aria-label="Credit line pagination" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="cl-primary-btn focus-ring"
                  onClick={onPreviousPage}
                  disabled={stablePage.pageIndex === 0}
                  style={{ opacity: stablePage.pageIndex === 0 ? 0.5 : 1 }}
                >Previous</button>
                <span aria-live="polite">Page {stablePage.pageIndex + 1} of {stablePage.pageCount}</span>
                <button
                  type="button"
                  className="cl-primary-btn focus-ring"
                  onClick={onNextPage}
                  disabled={stablePage.pageIndex >= stablePage.pageCount - 1}
                  style={{ opacity: stablePage.pageIndex >= stablePage.pageCount - 1 ? 0.5 : 1 }}
                >Next</button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default CreditLineList;
