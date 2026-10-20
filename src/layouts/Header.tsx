import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef, type RefObject } from "react";
import { NetworkStatus } from "../components/NetworkStatus";
import { KycTriggerButton } from "../components/KycDrawer";
import { QuickRepayTrigger } from "../components/QuickRepayTrigger";
import { WalletButton } from "../components/WalletButton";
import { NotificationWidget } from "../components/notifications/NotificationWidget";
import { ROUTE_MANIFEST } from "../routes/manifest";

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
  // active link in view (adjust scrollLeft only, never the page scroll).
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>(".header-nav-link.active");
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
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
        {ROUTE_MANIFEST.filter((route) => Boolean(route.nav?.header)).map((route) => (
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
      <KycTriggerButton triggerRef={kycTriggerRef} onClick={onKycClick} />
      <QuickRepayTrigger />
      <NotificationWidget />
      <WalletButton />
    </header>
  );
}
