import { useId, useRef, useState, useEffect, useCallback } from "react";
import { Info } from "lucide-react";
import "./HelpPopover.css";

interface HelpPopoverProps {
  /** The label or term being explained. */
  term: string;
  /** The explanation/definition shown inside the popover. */
  definition: string | React.ReactNode;
  /** Optional placement — defaults to top. */
  placement?: "top" | "bottom";
}

/**
 * A click-to-open popover that shows contextual help for a term or metric.
 *
 * - Clicking the info icon toggles the popover.
 * - Pressing Escape closes it.
 * - Clicking outside closes it.
 * - Uses `aria-expanded` and `aria-describedby` for screen-reader support.
 * - Respects `prefers-reduced-motion` by disabling the entrance animation.
 */
export function HelpPopover({
  term,
  definition,
  placement = "top",
}: HelpPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    // Use mousedown to close before the trigger's click fires
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen, handleClose]);

  return (
    <span className="help-popover-wrapper">
      <button
        ref={triggerRef}
        type="button"
        className="help-popover__trigger"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popoverId : undefined}
        aria-label={`Help: ${term}`}
      >
        <Info size={14} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="tooltip"
          className={`help-popover__content help-popover__content--${placement}`}
          data-placement={placement}
        >
          <strong className="help-popover__term">{term}</strong>
          <p className="help-popover__definition">{definition}</p>
        </div>
      )}
    </span>
  );
}