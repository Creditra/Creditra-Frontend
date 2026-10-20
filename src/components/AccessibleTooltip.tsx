import {
  useId,
  useState,
  useRef,
  useEffect,
  cloneElement,
  isValidElement,
  type ReactNode,
  type ReactElement,
  type KeyboardEvent,
} from 'react';
import './AccessibleTooltip.css';

interface AccessibleTooltipProps {
  /** Plain-text label surfaced visually and to assistive tech via `aria-describedby`. */
  label: string;
  /**
   * Optional content to render as the tooltip trigger. When this is a
   * single interactive element (e.g. a `<button>`), that element itself
   * becomes the focusable trigger — its own `aria-describedby` is merged
   * with the tooltip id instead of the wrapper stealing focus/label. When
   * it is plain text (or omitted), the built-in "i" info affordance is
   * rendered instead.
   */
  children?: ReactNode;
  /** Tooltip placement relative to the trigger. @default 'top' */
  position?: 'top' | 'bottom';
  /** Delay (ms) before a mouse hover reveals the tooltip. @default 400 */
  hoverDelay?: number;
  /** Delay (ms) before a touch long-press reveals the tooltip. @default 500 */
  longPressDelay?: number;
  /** When true, the tooltip never shows (hover/focus/touch are no-ops). */
  disabled?: boolean;
}

/**
 * Compact keyboard-focusable tooltip trigger.
 *
 * Two modes:
 * - No children (or plain-text children): renders a small "i" (or
 *   underlined-text) affordance that is itself the focusable trigger.
 * - A single interactive element as children (e.g. a `<button>`): that
 *   element becomes the trigger. Its `aria-describedby` is merged with the
 *   tooltip id only while the tooltip is visible, so screen readers never
 *   announce a stale reference to hidden content, and the child's own
 *   label/semantics are preserved (no extra focus stop, no `aria-label`
 *   override).
 *
 * Shows on hover (after `hoverDelay`), touch long-press (after
 * `longPressDelay`, cancelled by `touchmove`), and keyboard focus. Escape
 * dismisses it without stopping propagation, so an enclosing dialog's own
 * Escape handler still fires.
 */
export function AccessibleTooltip({
  label,
  children,
  position = 'top',
  hoverDelay = 400,
  longPressDelay = 500,
  disabled = false,
}: AccessibleTooltipProps) {
  const tooltipId = useId();
  const hasInlineContent = Boolean(children);
  const isInteractiveChild = isValidElement(children);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const scheduleShow = (delay: number) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setIsVisible(true);
    }, delay);
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    scheduleShow(hoverDelay);
  };

  const handleMouseLeave = () => {
    clearTimer();
    setIsVisible(false);
  };

  const handleTouchStart = () => {
    if (disabled) return;
    scheduleShow(longPressDelay);
  };

  const handleTouchEnd = () => {
    clearTimer();
    setIsVisible(false);
  };

  const handleTouchMove = () => {
    // Cancels a still-pending long-press; a no-op once already visible
    // (timerRef is already null by then).
    clearTimer();
  };

  const handleFocus = () => {
    if (disabled) return;
    clearTimer();
    setIsVisible(true);
  };

  const handleBlur = () => {
    clearTimer();
    setIsVisible(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape' && isVisible) {
      setIsVisible(false);
    }
    // Deliberately no stopPropagation — an enclosing dialog/menu's own
    // Escape handler must still run.
  };

  useEffect(() => {
    return clearTimer;
  }, []);

  const wrapperClassName = [
    'accessible-tooltip',
    'tooltip-wrapper',
    hasInlineContent ? 'accessible-tooltip--inline' : '',
    position === 'bottom' ? 'accessible-tooltip--bottom' : '',
  ]
    .filter(Boolean)
    .join(' ');

  let trigger: ReactNode;
  if (isInteractiveChild) {
    const child = children as ReactElement<{ 'aria-describedby'?: string }>;
    const existingDescribedBy = child.props['aria-describedby'];
    const describedBy = isVisible
      ? [existingDescribedBy, tooltipId].filter(Boolean).join(' ')
      : existingDescribedBy;
    trigger = cloneElement(child, {
      'aria-describedby': describedBy || undefined,
    });
  } else if (hasInlineContent) {
    trigger = (
      <span
        tabIndex={0}
        className="accessible-tooltip__trigger accessible-tooltip__trigger--text"
        aria-label="More information"
        aria-describedby={tooltipId}
      >
        <span className="accessible-tooltip__label">{children}</span>
      </span>
    );
  } else {
    trigger = (
      <span
        tabIndex={0}
        className="accessible-tooltip__trigger"
        aria-label="More information"
        aria-describedby={tooltipId}
      >
        <span aria-hidden="true">i</span>
      </span>
    );
  }

  return (
    <span
      className={wrapperClassName}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      <span
        id={tooltipId}
        role="tooltip"
        className={`accessible-tooltip__content${isVisible ? ' is-visible' : ''}`}
      >
        {label}
      </span>
    </span>
  );
}
