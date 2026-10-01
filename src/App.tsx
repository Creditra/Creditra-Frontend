import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { RouteAnnouncer, RouteHeadProvider } from "./components/RouteAnnouncer";
import { WalletProvider } from "./context/WalletContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ContrastProvider } from "./context/ContrastContext";
import { KycProvider } from "./context/KycContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ReducedMotionProvider } from "./context/ReducedMotionContext";
import { KycDrawer } from "./components/KycDrawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShortcutHelpOverlay } from "./components/ShortcutHelpOverlay";
import { WalletReconnectBanner } from "./components/WalletReconnectBanner";
import { NetworkMismatchBanner } from "./components/notifications/NetworkMismatchBanner";
import { Header } from "./layouts/Header";
import { Skeleton } from "./components/Skeleton";

// ── Code-split route components (non-critical for first paint) ────────────────
const Dashboard = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const DrawCreditPage = lazy(() => import("./pages/DrawCreditPage"));
const CreditLines = lazy(() => import("./pages/CreditLines"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory").then(m => ({ default: m.TransactionHistory })));
const RequestEvaluation = lazy(() => import("./pages/RequestEvaluation").then(m => ({ default: m.RequestEvaluation })));
const NotFound = lazy(() => import("./pages/NotFound").then(m => ({ default: m.NotFound })));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const DutchAuctions = lazy(() => import("./pages/DutchAuctions").then(m => ({ default: m.DutchAuctions })));
const LinkedAccounts = lazy(() => import("./pages/LinkedAccounts").then(m => ({ default: m.LinkedAccounts })));
const SessionTimeoutBanner = lazy(() => import("./components/SessionTimeoutBanner").then(m => ({ default: m.SessionTimeoutBanner })));
const NotificationPreferences = lazy(() => import("./pages/NotificationPreferences").then(m => ({ default: m.NotificationPreferences })));
const RepayPage = lazy(() => import("./pages/RepayPage"));
const CreditLineCompare = lazy(() => import("./pages/CreditLineCompare"));

export interface RouteConfig {
  path: string;
  element: React.ReactElement;
  name: string;
}

export const APP_ROUTES: RouteConfig[] = [
  { path: "/", element: <Dashboard />, name: "Dashboard" },
  { path: "/transactions", element: <TransactionHistory />, name: "Transaction History" },
  { path: "/credit-lines", element: <CreditLines />, name: "Credit Lines" },
  { path: "/compare-credit-lines", element: <CreditLineCompare />, name: "Compare Credit Lines" },
  { path: "/repay", element: <RepayPage />, name: "Repay" },
  { path: "/help", element: <HelpCenter />, name: "Help Center" },
  { path: "/draw-credit", element: <DrawCreditPage />, name: "Draw Credit" },
  {
    path: "/draw-credit/success",
    element: <DrawCreditPage />,
    name: "Draw Credit Success",
  },
  { path: "/open-credit", element: <RequestEvaluation />, name: "Request Evaluation" },
  { path: "/dutch-auctions", element: <DutchAuctions />, name: "Dutch Auctions" },
  { path: "/linked-accounts", element: <LinkedAccounts />, name: "Linked Accounts" },
  {
    path: "/notification-preferences",
    element: <NotificationPreferences />,
    name: "Notification Preferences",
  },
];

export const REGISTERED_PATHS: string[] = APP_ROUTES.map((r) => r.path);

// ── Suspense Fallback for Route Loading ───────────────────────────────────────
/** Minimal skeleton shown while route chunks load (preserves first paint). */
function RouteLoadingFallback() {
  return (
    <div style={{ padding: "2rem 0" }}>
      <Skeleton style={{ width: "200px", height: "32px", marginBottom: "0.5rem", borderRadius: "6px" }} />
      <Skeleton style={{ width: "300px", height: "16px", marginBottom: "2rem", borderRadius: "4px" }} />
      <Skeleton style={{ width: "100%", height: "200px", borderRadius: "8px" }} />
    </div>
  );
}

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
 *             <header />   — persistent nav chrome
 *             <main>
 *               <Routes /> — current route
 *             </main>
 *           </BrowserRouter>
 *         </WalletProvider>
 *       </ContrastProvider>
 *     </ThemeProvider>
 *   </ErrorBoundary>
 *
 * See docs/ARCHITECTURE.md for the full component topology.
 */
export interface AppProps {
  Router?: React.ComponentType<{ children: React.ReactNode }>;
}

export function App({ Router = BrowserRouter }: AppProps = {}) {
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [openedFromSettingsLink, setOpenedFromSettingsLink] = useState(false);
  const [isKycDrawerOpen, setIsKycDrawerOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const kycTriggerRef = useRef<HTMLButtonElement>(null);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → toggle command palette
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        paletteTriggerRef.current = document.activeElement as HTMLElement;
        setIsPaletteOpen((open) => !open);
        return;
      }

      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
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
                <ReducedMotionProvider>
                  <Router>
                    <RouteHeadProvider>
                      <RouteAnnouncer />
                      <div className="app">
                        <Header
                          settingsTriggerRef={settingsTriggerRef}
                          kycTriggerRef={kycTriggerRef}
                          onSettingsClick={() => {
                            setOpenedFromSettingsLink(true);
                            setIsShortcutHelpOpen(true);
                          }}
                          onKycClick={() => setIsKycDrawerOpen(true)}
                        />

                        {/* Wallet auto-reconnect timeout banner — self-dismissing,
                            non-blocking; only visible when reconnect takes > 8 s. */}
                        <WalletReconnectBanner />
                        {/* Session-timeout warning banner — visible 60 s before
                            the wallet extension silently disconnects (#227). */}
                        <Suspense fallback={null}>
                          <SessionTimeoutBanner />
                        </Suspense>
                        <main className="main">
                          <NetworkMismatchBanner />
                          <Suspense fallback={<RouteLoadingFallback />}>
                            <Routes>
                              {APP_ROUTES.map((route) => (
                                <Route
                                  key={route.path}
                                  path={route.path}
                                  element={route.element}
                                />
                              ))}
                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
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
                        <CommandPalette
                          isOpen={isPaletteOpen}
                          onClose={() => setIsPaletteOpen(false)}
                          triggerRef={paletteTriggerRef}
                        />
                      </div>
                    </RouteHeadProvider>
                  </Router>
                </ReducedMotionProvider>
              </NotificationProvider>
            </KycProvider>
          </WalletProvider>
        </ContrastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
