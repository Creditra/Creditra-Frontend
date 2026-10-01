import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  FilePlus,
  Gavel,
} from 'lucide-react';
import { cx } from '../utils/classnames';
import './BottomNav.css';

/**
 * Navigation item configuration for the bottom nav bar.
 * Each item maps to a route in the application.
 */
interface BottomNavItem {
  /** Unique identifier for the nav item. */
  id: string;
  /** Display label — visually hidden on very narrow viewports. */
  label: string;
  /** Route path the item navigates to. */
  to: string;
  /** Lucide icon component. */
  Icon: LucideIcon;
  /** Whether the route match must be exact (e.g. for `/`). */
  exact?: boolean;
}

const NAV_ITEMS: BottomNavItem[] = [
  { id: 'nav-dashboard',    label: 'Dashboard',      to: '/',               Icon: LayoutDashboard, exact: true },
  { id: 'nav-transactions', label: 'Transactions',   to: '/transactions',   Icon: ArrowLeftRight },
  { id: 'nav-credit-lines', label: 'Credit Lines',   to: '/credit-lines',   Icon: CreditCard },
  { id: 'nav-open-credit',  label: 'Open Credit',    to: '/open-credit',    Icon: FilePlus },
  { id: 'nav-auctions',     label: 'Auctions',       to: '/dutch-auctions', Icon: Gavel },
];

/**
 * Mobile-first bottom navigation bar.
 *
 * Visible only on viewports ≤ 768 px (`--bp-mobile`). Provides icon + label
 * links to the primary application routes. The active route is visually
 * distinguished with the accent colour and a top-border indicator.
 *
 * Accessibility (WCAG 2.1 AA):
 * - Every item is a semantic `<a>` via React Router's `NavLink`.
 * - Touch targets are ≥ 44 × 44 px (WCAG 2.5.5).
 * - `aria-current="page"` is set automatically by `NavLink` on the active item.
 * - Icons are marked `aria-hidden="true"` so screen readers announce only the label.
 * - Focus indicators use the shared focus-ring pattern.
 *
 * Motion:
 * - Entrance animation (`bottom-nav--enter`) under normal conditions.
 * - Suppressed when `prefers-reduced-motion: reduce` is active.
 *
 * @example
 *   <BottomNav />
 */
export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="bottom-nav"
      aria-label="Primary navigation"
      role="navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.to
          : location.pathname.startsWith(item.to);

        return (
          <Link
            key={item.id}
            to={item.to}
            className={cx('bottom-nav__link', { 'bottom-nav__link--active': isActive })}
            aria-current={isActive ? 'page' : undefined}
          >
            <item.Icon
              className="bottom-nav__icon"
              size={22}
              strokeWidth={isActive ? 2.5 : 1.75}
              aria-hidden="true"
            />
            <span className="bottom-nav__label">{item.label}</span>
            </Link>
        );
      })}
    </nav>
  );
}

export { NAV_ITEMS, NAV_ITEMS as BOTTOM_NAV_ITEMS };
