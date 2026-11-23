import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { KycProvider } from "../context/KycContext";
import { NotificationProvider } from "../context/NotificationContext";
import { WalletProvider } from "../context/WalletContext";
import { BottomNav } from "../components/BottomNav";
import { KycDrawer } from "../components/KycDrawer";
import { ToastContainer } from "../components/notifications/ToastContainer";
import CompareLinesPanel from "../components/CompareLinesPanel";
import { Header } from "../layouts/Header";
import type { CreditLine } from "../types/creditLine";

vi.mock("../hooks/useOnline", () => ({
  useOnline: () => ({
    isOnline: true,
    queueAction: vi.fn(),
    checkOnlineStatus: vi.fn(),
    queuedActionCount: 0,
  }),
}));

vi.mock("../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));
vi.mock("../hooks/useBodyScrollLock", () => ({ useBodyScrollLock: vi.fn() }));
vi.mock("../hooks/useInertBackdrop", () => ({ useInertBackdrop: vi.fn() }));

const sampleLines = [
  {
    id: "line-a",
    name: "Primary",
    status: "Active",
    limit: 1000,
    utilized: 250,
    apr: 8,
    riskScore: 720,
    openedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "line-b",
    name: "Secondary",
    status: "Active",
    limit: 2000,
    utilized: 500,
    apr: 9,
    riskScore: 690,
    openedAt: "2026-02-01T00:00:00.000Z",
  },
] as unknown as CreditLine[];

describe("RTL layout smoke test", () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("dir");
    vi.restoreAllMocks();
  });

  it("renders the header, navigation, KYC drawer, comparison panel and toast container in RTL", () => {
    document.documentElement.dir = "rtl";

    render(
      <MemoryRouter>
        <NotificationProvider>
          <WalletProvider>
            <KycProvider>
              <Header
                settingsTriggerRef={{ current: null }}
                kycTriggerRef={{ current: null }}
                onSettingsClick={vi.fn()}
                onKycClick={vi.fn()}
              />
              <BottomNav />
              <KycDrawer isOpen onClose={vi.fn()} onResume={vi.fn()} />
              <CompareLinesPanel lines={sampleLines} onClose={vi.fn()} />
              <ToastContainer />
            </KycProvider>
          </WalletProvider>
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /kyc progress/i })).toBeInTheDocument();
    expect(document.querySelector(".toast-container")).toBeInTheDocument();
    expect(document.querySelector("#compare-panel")?.getAttribute("style")).toContain("inset-inline-end: 0");

    const drawerCss = readFileSync(resolve(__dirname, "../components/KycDrawer.css"), "utf8");
    expect(drawerCss).toMatch(/\.kyc-drawer\s*\{[^}]*inset-inline-end:\s*0/s);
  });
});
