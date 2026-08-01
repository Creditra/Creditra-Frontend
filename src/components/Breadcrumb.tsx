import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  to?: string;
  /** Optional href — alias for `to` for compatibility. */
  href?: string;
}

export interface BreadcrumbProps {
  /** Ordered list of breadcrumb items (root first, current last). */
  items: BreadcrumbItem[];
  /** Maximum visible items before middle-ellipsis kicks in. Default 4. */
  maxVisible?: number;
  /** Maximum label length before middle-ellipsis truncation. Default 30. */
  ellipsisThreshold?: number;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Truncate a string with a middle ellipsis when it exceeds `maxLen`.
 *
 * Example: middleEllipsis('ABCDEFGHIJKLMNOP', 8) → 'ABCD…NOP'
 */
export function middleEllipsis(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;

  // Reserve one character for the ellipsis
  const headLen = Math.ceil((maxLen - 1) / 2);
  const tailLen = Math.floor((maxLen - 1) / 2);
  return text.slice(0, headLen) + '\u2026' + text.slice(-tailLen);
}

/**
 * Breadcrumb — accessible breadcrumb navigation with middle-ellipsis.
 *
 * When `items.length > maxVisible`, the middle items collapse into a single
 * "…" <li> that is `aria-hidden` but replaced by a screen-reader-only "… more"
 * label so assistive technology users understand there are hidden items.
 *
 * Individual labels longer than `ellipsisThreshold` are truncated with a
 * middle-ellipsis and the full text is provided via `title`.
 *
 * WCAG 2.1 AA:
 * - Renders inside a `<nav>` with `aria-label="Breadcrumb"`.
 * - Last item uses `aria-current="page"`.
 * - Separators are `aria-hidden="true"`.
 * - Focus rings use `.focus-ring` from `src/styles/focus.css`.
 */
export function Breadcrumb({
  items,
  maxVisible = 4,
  ellipsisThreshold = 30,
  className = '',
}: BreadcrumbProps) {
  if (items.length === 0) return null;

  const visible = deriveVisible(items, maxVisible);

  const containerClasses =    ['breadcrumb', className]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label="Breadcrumb" className={containerClasses}>
      <ol className="breadcrumb__list">
        {visible.map((item, idx) => {
          const isLast = idx === visible.length - 1;

          if (item === null) {
            // Middle ellipsis placeholder
            return (
              <li
                key={`ellipsis-${idx}`}
                className="breadcrumb__item breadcrumb__item--ellipsis"
                aria-hidden="true"
              >
                <span className="breadcrumb__ellipsis" aria-hidden="true">…</span>
                {/* Screen-reader-only label so AT users know items are hidden */}
                <span className="sr-only">… more</span>
              </li>
            );
          }

          const displayLabel =
            item.label.length > ellipsisThreshold
              ? middleEllipsis(item.label, ellipsisThreshold)
              : item.label;

          const needsTitle = item.label.length > ellipsisThreshold;
          const linkTarget = item.to || item.href;

          return (
            <li key={item.label} className="breadcrumb__item">
              {isLast ? (
                <span
                  className="breadcrumb__label breadcrumb__label--current"
                  aria-current="page"
                  title={needsTitle ? item.label : undefined}
                >
                  {displayLabel}
                </span>
              ) : linkTarget ? (
                <Link
                  to={linkTarget}
                  className="breadcrumb__link"
                  title={needsTitle ? item.label : undefined}
                >
                  {displayLabel}
                </Link>
              ) : (
                <span
                  className="breadcrumb__label"
                  title={needsTitle ? item.label : undefined}
                >
                  {displayLabel}
                </span>
              )}
              {!isLast && (
                <span className="breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Derive the visible items list with middle-ellipsis.
 *
 * When `items.length > maxVisible`, we show:
 *   [first, null, ...last (maxVisible-2)]
 * where null represents the ellipsis slot.
 */
function deriveVisible(
  items: BreadcrumbItem[],
  maxVisible: number,
): (BreadcrumbItem | null)[] {
  if (items.length <= maxVisible) return items;

  const tail = items.slice(-(maxVisible - 2));
  return [items[0], null, ...tail];
}

export default Breadcrumb;
