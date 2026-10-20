import type { ReactNode } from 'react';

export interface PreviewCardProps {
  /** Trigger element (e.g. a link or button). */
  children: ReactNode;
  /** Content revealed on hover/focus of the trigger. */
  preview: ReactNode;
  /** Label announced to screen readers when the preview becomes visible. */
  ariaLabel?: string;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * PreviewCard — a hover/focus preview region.
 *
 * Wraps a trigger element and shows a preview panel when the wrapper
 * receives hover or focus-within. The preview panel is announced to
 * screen readers via `aria-live="polite"` when it appears.
 *
 * WCAG 2.1 AA:
 * - All interactive children must have their own accessible names.
 * - The preview region has `role="region"` and `aria-label`.
 * - Focus rings delegated to `.focus-ring` from `src/styles/focus.css`.
 *
 * Usage:
 * ```tsx
 * <PreviewCard preview={<RepaymentSchedule />}>
 *   <button>View schedule</button>
 * </PreviewCard>
 * ```
 */
export function PreviewCard({
  children,
  preview,
  ariaLabel = 'Preview',
  className = '',
}: PreviewCardProps) {
  const containerClasses = ['preview-card', className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      <div className="preview-card__trigger">{children}</div>
      <div
        className="preview-card__preview"
        role="region"
        aria-label={ariaLabel}
        aria-live="polite"
        hidden
      >
        <div className="preview-card__preview-inner">{preview}</div>
      </div>
    </div>
  );
}

export default PreviewCard;
