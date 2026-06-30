import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CommandPalette } from "./components/CommandPalette";
import { Dashboard } from "./pages/Dashboard";
import { WalletProvider } from "./context/WalletContext";
import { KycProvider } from "./context/KycContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ReducedMotionProvider } from "./context/ReducedMotionContext";
import { KycDrawer } from "./components/KycDrawer";
import DrawCreditPage from "./pages/DrawCreditPage";
import CreditLines from "./pages/CreditLines";
import { TransactionHistory } from "./pages/TransactionHistory";
import { RequestEvaluation } from "./pages/RequestEvaluation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { NotFound } from "./pages/NotFound";
import HelpCenter from "./pages/HelpCenter";
import { ShortcutHelpOverlay } from "./components/ShortcutHelpOverlay";
import { DutchAuctions } from "./pages/DutchAuctions";
import { LinkedAccounts } from "./pages/LinkedAccounts";
import { WalletReconnectBanner } from "./components/WalletReconnectBanner";
import { NetworkMismatchBanner } from "./components/notifications/NetworkMismatchBanner";
import { Header } from "./layouts/Header";
import { SessionTimeoutBanner } from "./components/SessionTimeoutBanner";
import { NotificationPreferences } from "./pages/NotificationPreferences";

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
function App() {
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
      <WalletProvider>
        <KycProvider>
        <NotificationProvider>
        <ReducedMotionProvider>
        <BrowserRouter>
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
            <SessionTimeoutBanner />
            <main className="main">
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
                <Route path="/linked-accounts" element={<LinkedAccounts />} />
                <Route path="/notification-preferences" element={<NotificationPreferences />} />
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
            <CommandPalette
              isOpen={isPaletteOpen}
              onClose={() => setIsPaletteOpen(false)}
              triggerRef={paletteTriggerRef}
            />
          </div>
        </BrowserRouter>
        </ReducedMotionProvider>
        </NotificationProvider>
        </KycProvider>
      </WalletProvider>
    </ErrorBoundary>
  );
}

export default App;
