import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { NetworkStatus } from "../components/NetworkStatus";
import { openOfflineQueuePanel } from "../components/OfflineQueuePanel";
import {
  getQueuedActionsSnapshot,
  subscribeToOfflineQueue,
  type QueuedAction,
} from "../utils/offline";
import { KycTriggerButton } from "../components/KycDrawer";
import { QuickRepayTrigger } from "../components/QuickRepayTrigger";
import { WalletButton } from "../components/WalletButton";
import { PrivacyModeToggle } from "../components/PrivacyModeToggle";
import { NotificationWidget } from "../components/notifications/NotificationWidget";
import { getEnabledRoutes } from "../routes/manifest";

const EMPTY_QUEUE: readonly QueuedAction[] = Object.freeze([]);

/**
 * Header entry point for the offline queue. Shows how many actions are
 * waiting and opens the queue panel; renders nothing when the queue is empty.
 */
function OfflineQueueBadge() {
  const actions = useSyncExternalStore(
    subscribeToOfflineQueue,
    getQueuedActionsSnapshot,
    () => EMPTY_QUEUE,
  );

  if (actions.length === 0) return null;

  const label = `${actions.length} queued offline action${actions.length === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      className="header-nav-link offline-queue-badge"
      onClick={openOfflineQueuePanel}
      aria-label={`Open queued actions (${actions.length})`}
      title={label}
    >
      Queued
      <span className="offline-queue-badge__count" aria-hidden="true">
        {actions.length}
      </span>
    </button>
  );
}

export interface HeaderProps {
  settingsTriggerRef: RefObject<HTMLButtonElement | null>;
  kycTriggerRef: RefObject<HTMLButtonElement | null>;
  onSettingsClick: () => void;
  onKycClick: () => void;
}

/**
 * Persistent application header — logo, primary nav, and action controls.
 */
export function Header({
  settingsTriggerRef,
  kycTriggerRef,
  onSettingsClick,
  onKycClick,
}: HeaderProps) {
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // On narrow screens the nav is a horizontally scrolling row; keep the
  // active link in view using the browser's direction-aware inline scrolling.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>(".header-nav-link.active");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <header className="header">
      <Link to="/" className="logo">
        Creditra
      </Link>
      <nav className="header-nav" ref={navRef} aria-label="Primary">
        {/*
          NavLink with render function allows us to:
          1. Apply active class for styling (accent + underline + weight)
          2. Set aria-current="page" on active links for accessibility

          This satisfies WCAG 2.1 AA requirements:
          - 1.4.1: Use of Color - active state uses color + other visual indicators
          - 2.4.7: Focus Visible - outline differs from active underline
          - 2.4.8: Location - aria-current="page" indicates current page
        */}
        {getEnabledRoutes().filter((route) => Boolean(route.nav?.header)).map((route) => (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === "/"}
            className={({ isActive }) =>
              isActive ? "header-nav-link active" : "header-nav-link"
            }
          >
            {route.nav?.headerLabel ?? route.pageName}
          </NavLink>
        ))}
      </nav>
      <button
        ref={settingsTriggerRef}
        type="button"
        className="header-nav-link"
        onClick={onSettingsClick}
      >
        Settings
      </button>
      <NetworkStatus />
      <OfflineQueueBadge />
      <KycTriggerButton triggerRef={kycTriggerRef} onClick={onKycClick} />
      <QuickRepayTrigger />
      <PrivacyModeToggle />
      <NotificationWidget />
      <WalletButton />
    </header>
  );
}
