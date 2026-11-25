import React, { useState, useRef, useEffect, useId } from 'react';
import { MoreHorizontal, ArrowUpCircle, ArrowDownCircle, Calendar, Info, Snowflake, Shield, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreditLineRowMenuProps {
  lineId: string;
  lineName: string;
  frozen?: boolean;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onRepay?: () => void;
  onSchedule?: (lineId: string) => void;
  onDetails?: (lineId: string) => void;
  onFreeze?: (lineId: string) => void;
  onUnfreeze?: (lineId: string) => void;
  onAdjustCollateral?: (lineId: string) => void;
  onRequestLimitIncrease?: (lineId: string) => void;
  limitIncreaseDisabledReasons?: string[];
}

/**
 * A quick-action dropdown menu for credit line rows.
 * 
 * Provides actions: Repay, Draw, Schedule, and Details.
 * 
 * Accessibility:
 * - Uses aria-haspopup and aria-expanded to indicate menu state.
 * - Includes keyboard support (Escape to close).
 * - Handles clicking outside to close.
 * - Uses appropriate roles (menu, menuitem).
 */
export function CreditLineRowMenu({
  lineId,
  lineName,
  frozen,
  triggerRef,
  onRepay,
  onSchedule,
  onDetails,
  onFreeze,
  onUnfreeze,
  onAdjustCollateral,
  onRequestLimitIncrease,
  limitIncreaseDisabledReasons = [],
}: CreditLineRowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted hover:text-foreground hover:bg-surface rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={`Menu for ${lineName}`}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg border border-border bg-surface py-1 shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Repay */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (onRepay) onRepay();
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
            role="menuitem"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Repay
          </button>

          {/* Draw */}
          <Link
            to={`/draw-credit?line=${lineId}`}
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors"
            role="menuitem"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Draw
          </Link>

          {onRequestLimitIncrease && (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onRequestLimitIncrease(lineId);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-foreground"
                role="menuitem"
                disabled={limitIncreaseDisabledReasons.length > 0}
                aria-describedby={
                  limitIncreaseDisabledReasons.length > 0 ? reasonId : undefined
                }
              >
                <TrendingUp className="w-4 h-4" />
                Request limit increase
              </button>
              {limitIncreaseDisabledReasons.length > 0 && (
                <p id={reasonId} className="px-4 pb-2 text-xs text-muted" role="note">
                  {limitIncreaseDisabledReasons.join(' ')}
                </p>
              )}
            </>
          )}

          {/* Freeze / Unfreeze */}
          {(onFreeze || onUnfreeze) && (
            <button
              onClick={() => {
                setIsOpen(false);
                if (frozen && onUnfreeze) onUnfreeze(lineId);
                else if (!frozen && onFreeze) onFreeze(lineId);
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
              role="menuitem"
            >
              <Snowflake className="w-4 h-4" />
              {frozen ? 'Unfreeze' : 'Freeze'}
            </button>
          )}

          {/* Schedule */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (onSchedule) onSchedule(lineId);
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
            role="menuitem"
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>

          {/* Adjust Collateral */}
          {onAdjustCollateral && (
            <button
              onClick={() => {
                setIsOpen(false);
                onAdjustCollateral(lineId);
              }}
              className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
              role="menuitem"
            >
              <Shield className="w-4 h-4" />
              Adjust Collateral
            </button>
          )}

          {/* Details */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (onDetails) onDetails(lineId);
            }}
            className="flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
            role="menuitem"
          >
            <Info className="w-4 h-4" />
            Details
          </button>
        </div>
      )}
    </div>
  );
}
