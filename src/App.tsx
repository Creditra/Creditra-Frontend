import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes, Link, NavLink } from "react-router-dom";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { Dashboard } from "./pages/Dashboard";
import {
  RouteAnnouncer,
  RouteHeadProvider,
} from "./components/RouteAnnouncer";
import { WalletProvider } from "./context/WalletContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ContrastProvider } from "./context/ContrastContext";
import { KycProvider } from "./context/KycContext";
import { NotificationProvider } from "./context/NotificationContext";
import { WalletButton } from "./components/WalletButton";
import { QuickRepayTrigger } from "./components/QuickRepayTrigger";
import { KycDrawer, KycTriggerButton } from "./components/KycDrawer";
import { NetworkMismatchBanner } from "./components/NetworkMismatchBanner";
import { WalletReconnectBanner } from "./components/WalletReconnectBanner";
import DrawCreditPage from "./pages/DrawCreditPage";
import CreditLines from "./pages/CreditLines";
import { TransactionHistory } from "./pages/TransactionHistory";
import { RequestEvaluation } from "./pages/RequestEvaluation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotFound } from "./pages/NotFound";
import HelpCenter from "./pages/HelpCenter";
import { ShortcutHelpOverlay } from "./components/ShortcutHelpOverlay";
import { DutchAuctions } from "./pages/DutchAuctions";
import RepayPage from "./pages/RepayPage";
import RepayCalendar from "./pages/RepayCalendar";
import { SettingsAccount } from "./pages/SettingsAccount";
import { Theme } from "./pages/settings/Theme";
import { LinkedAccounts } from "./pages/LinkedAccounts";
import { WalletReconnectBanner } from "./components/WalletReconnectBanner";
import { SessionTimeoutBanner } from "./components/SessionTimeoutBanner";
import { NetworkMismatchBanner } from "./components/notifications/NetworkMismatchBanner";
import { Header } from "./layouts/Header";
import CreditLineCompare from "./pages/CreditLineCompare";
import { TermsBanner } from "./components/TermsBanner";
import { ToastContainer } from "./components/ToastContainer";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
};

/**
 * Application root.
 *
 * Provider composition order (outer → inner):
 *
 *   <ErrorBoundary>      — catches render errors in everything below
 *     <ThemeProvider>    — colour-scheme (light/dark) preference
 *       <ContrastProvider> — high-contrast override, [data-contrast="high"]
 *         <WalletProvider> — wallet lifecycle visible to every route
 *           <BrowserRouter>
 *             <RouteHeadProvider> — per-route title/description/announcement
 *               <RouteAnnouncer /> — bound to the URL + override context
 *               <header />         — persistent nav chrome
 *               <main>
 *                 <Routes />        — current route
 *               </main>
 *             </RouteHeadProvider>
 *           </BrowserRouter>
 *         </WalletProvider>
 *       </ContrastProvider>
 *     </ThemeProvider>
 *   </ErrorBoundary>
 *
 * Note on the RouteStack pair (RouteHeadProvider + RouteAnnouncer):
 *   Previously the RouteAnnouncer component was defined but never
 *   mounted in the running app; pages relied on whatever browser
 *   title survived from the last navigation.  GitHub issue #451
 *   ("Add per-route RouteAnnouncer") asked us to (a) actually mount
 *   it so every navigation triggers a screen-reader announcement,
 *   and (b) let individual pages push custom titles + descriptions
 *   via `useRouteHead`.  The provider context here enables (b) without
 *   forcing every page into a wrapper.
 *
 * See docs/ARCHITECTURE.md for the full component topology.
 */
function App() {
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [openedFromSettingsLink, setOpenedFromSettingsLink] = useState(false);
  const [isKycDrawerOpen, setIsKycDrawerOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const kycTriggerRef = useRef<HTMLButtonElement>(null);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteTriggerRef = useRef<HTMLElement | null>(null);

  // Restore scroll position on route navigation.
  useScrollRestoration();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → toggle command palette
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        paletteTriggerRef.current = document.activeElement as HTMLElement;
        setIsPaletteOpen((open) => !open);
        return;
      }

      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      if (event.key !== "?") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      setOpenedFromSettingsLink(false);
      setIsShortcutHelpOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ContrastProvider>
          <WalletProvider>
            <KycProvider>
              <NotificationProvider>
                <BrowserRouter>
                  <RouteHeadProvider>
                    <div className="app">
                      <header className="header">
                        <Link to="/" className="logo">
                          Creditra
                        </Link>
                      <nav className="header-nav">
                        {/*
                          NavLink with render function allows us to:
                          1. Apply active class for styling (accent + underline + weight)
                          2. Set aria-current="page" on active links for accessibility

                          This satisfies WCAG 2.1 AA requirements:
                          - 1.4.1: Use of Color - active state uses color + other visual indicators
                          - 2.4.7: Focus Visible - outline differs from active underline
                          - 2.4.8: Location - aria-current="page" indicates current page
                        */}
                        <NavLink
                          to="/"
                          end
                          className={({ isActive }) =>
                            isActive ? "header-nav-link active" : "header-nav-link"
                          }
                        >
                          Dashboard
                        </NavLink>
                        <NavLink
                          to="/transactions"
                          className={({ isActive }) =>
                            isActive ? "header-nav-link active" : "header-nav-link"
                          }
                        >
                          Transactions
                        </NavLink>
                        <NavLink
                          to="/credit-lines"
                          className={({ isActive }) =>
                            isActive ? "header-nav-link active" : "header-nav-link"
                          }
                        >
                          Credit Lines
                        </NavLink>
                        <NavLink
                          to="/open-credit"
                          className={({ isActive }) =>
                            isActive ? "header-nav-link active" : "header-nav-link"
                          }
                        >
                          Open Credit Line
                        </NavLink>
                        <NavLink
                          to="/dutch-auctions"
                          className={({ isActive }) =>
                            isActive ? "header-nav-link active" : "header-nav-link"
                          }
                        >
                          Dutch Auctions
                        </NavLink>
                      </nav>
                      <button
                        ref={settingsTriggerRef}
                        type="button"
                        className="header-nav-link"
                        onClick={() => {
                          setOpenedFromSettingsLink(true);
                          setIsShortcutHelpOpen(true);
                        }}
                      >
                        Settings
                      </button>
                      <button
                        type="button"
                        className="header-nav-link header-cmdk-btn"
                        aria-label="Open command palette"
                        aria-keyshortcuts="Control+K Meta+K"
                        onClick={(e) => {
                          paletteTriggerRef.current = e.currentTarget;
                          setIsPaletteOpen(true);
                        }}
                      >
                        <span aria-hidden="true">Search</span>
                        <kbd className="header-cmdk-kbd" aria-hidden="true">⌘K</kbd>
                      </button>
                      <KycTriggerButton
                        triggerRef={kycTriggerRef}
                        onClick={() => setIsKycDrawerOpen(true)}
                      />
                      <QuickRepayTrigger />
                      <WalletButton />
                    </header>

                    {/* Wallet auto-reconnect timeout banner — self-dismissing,
                        non-blocking; only visible when reconnect takes > 8 s. */}
                    <WalletReconnectBanner />
                    <main className="main">
                      <TermsBanner />
                      <NetworkMismatchBanner />
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/transactions" element={<TransactionHistory />} />
                        <Route path="/credit-lines" element={<CreditLines />} />
                        <Route path="/help" element={<HelpCenter />} />
                        <Route path="/draw-credit" element={<DrawCreditPage />} />
                        <Route
                          path="/draw-credit/success"
                          element={<DrawCreditPage />}
                        />
                        <Route path="/open-credit" element={<RequestEvaluation />} />
                        <Route path="/dutch-auctions" element={<DutchAuctions />} />
                        <Route path="/settings/account" element={<SettingsAccount />} />
                        <Route path="/settings/theme" element={<Theme />} />
                        <Route path="/linked-accounts" element={<LinkedAccounts />} />
                        {/* Issue #581: Repay flow (now reachable from header /
                            the "Repay" action on Credit Lines). */}
                        <Route path="/repay" element={<RepayPage />} />
                        <Route path="/repay/calendar" element={<RepayCalendar />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                    <ShortcutHelpOverlay
                      isOpen={isShortcutHelpOpen}
                      onClose={() => setIsShortcutHelpOpen(false)}
                      triggerRef={openedFromSettingsLink ? settingsTriggerRef : undefined}
                    />
                    <KycDrawer
                      isOpen={isKycDrawerOpen}
                      onClose={() => setIsKycDrawerOpen(false)}
                      onResume={(stepId) => {
                        // Navigate to the KYC page with the step pre-selected.
                        // Replace with router.push('/kyc?step=' + stepId) when the
                        // full KYC page exists.
                        console.info('[KYC] Resume at step:', stepId);
                      }}
                      triggerRef={kycTriggerRef}
                    />
                    {/* Mounted inside <RouteHeadProvider> so it can read the
                        override context, and inside <BrowserRouter> so it can
                        read useLocation().  Renders a sr-only polite status
                        region for screen-reader route announcements. */}
                    <RouteAnnouncer />

                    {/*
                     * Centralized accessible toast queue.
                     * Fixed-position overlay at top-right of viewport.
                     * Renders inside NotificationProvider so it can consume
                     * useNotifications(). Does NOT need routing context, so it
                     * lives here rather than inside <Routes>.
                     *
                     * WCAG: role="status" + aria-live="polite" on the outer
                     * container, individual items use role="status" or
                     * role="alert" per severity (SC 4.1.3 Status Messages).
                     */}
                    <ToastContainer />
                  </div>
                  </RouteHeadProvider>
                </BrowserRouter>
              </NotificationProvider>
            </KycProvider>
          </WalletProvider>
        </ContrastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
