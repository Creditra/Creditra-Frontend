import { useRef, useState, lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { RouteAnnouncer, RouteHeadProvider } from "./components/RouteAnnouncer";
import { WalletProvider } from "./context/WalletContext";
import { CreditDataProvider } from "./context/CreditDataContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ContrastProvider } from "./context/ContrastContext";
import { PrivacyModeProvider, usePrivacyMode } from "./context/PrivacyContext";
import { KycProvider } from "./context/KycContext";
import { NotificationProvider } from "./context/NotificationContext";
import { AuctionAlertWatcher } from "./components/AuctionAlertWatcher";
import { ReducedMotionProvider } from "./context/ReducedMotionContext";
import { KycDrawer } from "./components/KycDrawer";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShortcutHelpOverlay } from "./components/ShortcutHelpOverlay";
import { WalletReconnectBanner } from "./components/WalletReconnectBanner";
import { NetworkMismatchBanner } from "./components/notifications/NetworkMismatchBanner";
import { ToastContainer } from "./components/notifications/ToastContainer";
import { BannerAlerts } from "./components/notifications/BannerAlert";
import { Header } from "./layouts/Header";
import { Skeleton } from "./components/Skeleton";
import { useHotkey } from "./lib/hotkeys";

import { getEnabledRoutes } from "./routes/manifest";

// ── Code-split route components (non-critical for first paint) ────────────────
const NotFound = lazy(() => import("./pages/NotFound").then(m => ({ default: m.NotFound })));
const SessionTimeoutBanner = lazy(() => import("./components/SessionTimeoutBanner").then(m => ({ default: m.SessionTimeoutBanner })));

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

function AppShell() {
  const navigate = useNavigate();
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [openedFromSettingsLink, setOpenedFromSettingsLink] = useState(false);
  const [isKycDrawerOpen, setIsKycDrawerOpen] = useState(false);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const kycTriggerRef = useRef<HTMLButtonElement>(null);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const paletteTriggerRef = useRef<HTMLElement | null>(null);

  useHotkey({
    combo: "Mod+K",
    scope: "global",
    description: "Toggle command palette",
    allowInEditable: true,
    handler: (event) => {
      event.preventDefault();
      paletteTriggerRef.current = document.activeElement as HTMLElement;
      setIsPaletteOpen((open) => !open);
    },
  });

  useHotkey({
    combo: "?",
    scope: "global",
    description: "Open this keyboard shortcut guide",
    handler: (event) => {
      event.preventDefault();
      setOpenedFromSettingsLink(false);
      setIsShortcutHelpOpen(true);
    },
  });

  return (
    <>
      <AuctionAlertWatcher />
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
            <BannerAlerts />
            <NetworkMismatchBanner />
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {getEnabledRoutes().map((route) => {
                  const RouteComponent = route.Component;
                  return (
                    <Route
                      key={route.path}
                      path={route.path}
                      element={<RouteComponent />}
                    />
                  );
                })}
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
              navigate(`/kyc?step=${encodeURIComponent(stepId)}`);
            }}
            triggerRef={kycTriggerRef}
          />
          <CommandPalette
            isOpen={isPaletteOpen}
            onClose={() => setIsPaletteOpen(false)}
            triggerRef={paletteTriggerRef}
            extraItems={[
              {
                id: "toggle-privacy-mode",
                label: "Toggle privacy mode",
                description: privacyMode
                  ? "Show balances and amounts again"
                  : "Mask balances and amounts across the app",
                icon: privacyMode ? "🙈" : "👁️",
                action: togglePrivacyMode,
              },
            ]}
          />
          <ToastContainer />
        </div>
      </RouteHeadProvider>
    </>
  );
}

/**
 * Application root.
 *
 * Provider composition order (outer → inner):
 *
 *   <ErrorBoundary>      — catches render errors in everything below
 *     <ThemeProvider>    — colour-scheme (light/dark) preference
 *       <ContrastProvider> — high-contrast override, [data-contrast="high"]
 *         <PrivacyModeProvider> — app-wide amount masking, [data-privacy-mode="on"]
 *           <WalletProvider> — wallet lifecycle visible to every route
 *             <CreditDataProvider> — wallet-scoped credit line and transaction data
 *               <BrowserRouter>
 *               <header />   — persistent nav chrome
 *               <main>
 *                 <Routes /> — current route
 *               </main>
 *               </BrowserRouter>
 *             </CreditDataProvider>
 *           </WalletProvider>
 *         </PrivacyModeProvider>
 *       </ContrastProvider>
 *     </ThemeProvider>
 *   </ErrorBoundary>
 *
 * See docs/ARCHITECTURE.md for the full component topology.
 */
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ContrastProvider>
          <PrivacyModeProvider>
            <WalletProvider>
              <CreditDataProvider>
                <KycProvider>
                  <NotificationProvider>
                    <ReducedMotionProvider>
                      <BrowserRouter>
                        <AppShell />
                      </BrowserRouter>
                    </ReducedMotionProvider>
                  </NotificationProvider>
                </KycProvider>
              </CreditDataProvider>
            </WalletProvider>
          </PrivacyModeProvider>
        </ContrastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
