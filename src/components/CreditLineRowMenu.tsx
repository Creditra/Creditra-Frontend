import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, ArrowUpCircle, ArrowDownCircle, Calendar, Info, Snowflake } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CreditLineRowMenuProps {
  lineId: string;
  lineName: string;
  frozen?: boolean;
  onRepay?: () => void;
  onSchedule?: (lineId: string) => void;
  onDetails?: (lineId: string) => void;
  onFreeze?: (lineId: string) => void;
  onUnfreeze?: (lineId: string) => void;
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
  onRepay,
  onSchedule,
  onDetails,
  onFreeze,
  onUnfreeze,
}: CreditLineRowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
            className="focus-ring cl-row-menu-item flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
            role="menuitem"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Repay
          </button>

          {/* Draw */}
          <Link
            to={`/draw-credit?line=${lineId}`}
            onClick={() => setIsOpen(false)}
            className="focus-ring cl-row-menu-item flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors"
            role="menuitem"
          >
            <ArrowDownCircle className="w-4 h-4" />
            Draw
          </Link>

          {/* Freeze / Unfreeze */}
          {(onFreeze || onUnfreeze) && (
            <button
              onClick={() => {
                setIsOpen(false);
                if (frozen && onUnfreeze) onUnfreeze(lineId);
                else if (!frozen && onFreeze) onFreeze(lineId);
              }}
              className="focus-ring cl-row-menu-item flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
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
            className="focus-ring cl-row-menu-item flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
            role="menuitem"
          >
            <Calendar className="w-4 h-4" />
            Schedule
          </button>

          {/* Details */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (onDetails) onDetails(lineId);
            }}
            className="focus-ring cl-row-menu-item flex w-full items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent/10 hover:text-accent transition-colors text-left"
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
