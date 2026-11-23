import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { NextSteps } from "./NextSteps";
import { useKyc } from "../context/KycContext";
import { fetchLinkedAccounts } from "../services/linkedAccounts";
import { useWallet } from "../context/WalletContext";
import { useCreditLines } from "../hooks/useCreditLines";

// Mock the dependencies
vi.mock("../context/KycContext", () => ({
  useKyc: vi.fn(),
}));

vi.mock("../services/linkedAccounts", () => ({
  fetchLinkedAccounts: vi.fn(),
}));

// The component derives the per-wallet storage key from the connected wallet,
// so both `useWallet` and `walletIdentityKey` must be present.
vi.mock("../context/WalletContext", () => ({
  useWallet: vi.fn(),
  walletIdentityKey: (
    wallet: { type?: string; publicKey?: string; network?: string } | null,
  ) => (wallet ? `${wallet.type}:${wallet.publicKey}:${wallet.network}` : null),
}));

vi.mock("../hooks/useCreditLines", () => ({
  useCreditLines: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(ui, { wrapper: BrowserRouter });
};

/** YYYY-MM-DD string for a date offset from today, in the local timezone. */
function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function mockKyc(overallStatus: string) {
  vi.mocked(useKyc).mockReturnValue({
    steps: [],
    overallStatus,
    resumeStepId: "identity",
    completedCount: 0,
    setStepStatus: vi.fn(),
    resetAll: vi.fn(),
  } as never);
}

function mockWalletHasIdentity(connected = false) {
  vi.mocked(useWallet).mockReturnValue({
    wallet: connected
      ? { type: "freighter", publicKey: "GABC123", network: "TESTNET" }
      : null,
  } as never);
}

function mockLines(lines: unknown[] = []) {
  vi.mocked(useCreditLines).mockReturnValue({
    lines,
    status: "success",
    error: null,
    lastUpdatedAt: new Date(),
    refetch: vi.fn(),
  } as never);
}

describe("NextSteps Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
    mockWalletHasIdentity(false);
    mockLines([]);
  });

  it("renders the loading skeleton initially", () => {
    mockKyc("not_started");
    // Keep fetchLinkedAccounts pending
    vi.mocked(fetchLinkedAccounts).mockReturnValue(new Promise(() => {}));

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    expect(screen.getByLabelText(/loading next steps/i)).toBeInTheDocument();
  });

  it("surfaces KYC todo and other steps as locked when KYC is not started and no accounts are linked", async () => {
    mockKyc("not_started");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/loading next steps/i)).not.toBeInTheDocument();
    });

    // Check Verify KYC is Todo
    const kycStep = screen.getByRole("listitem", { name: /Step 1: Verify KYC. Status: Action Required/i });
    expect(kycStep).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start verification/i })).toBeInTheDocument();

    // Check Link Account is Locked
    const linkStep = screen.getByRole("listitem", { name: /Step 2: Link Account. Status: Locked/i });
    expect(linkStep).toBeInTheDocument();

    // Check Draw Credit is Locked
    const drawStep = screen.getByRole("listitem", { name: /Step 3: Draw Credit. Status: Locked/i });
    expect(drawStep).toBeInTheDocument();
  });

  it("shows KYC under review status", async () => {
    mockKyc("under_review");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getAllByText(/under review/i).length).toBeGreaterThan(0);
    });
  });

  it("shows KYC rejected status as a retry action", async () => {
    mockKyc("rejected");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry verification/i })).toBeInTheDocument();
    });
  });

  it("unlocks Link Account step when KYC is approved, and shows it as todo", async () => {
    mockKyc("approved");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getByRole("listitem", { name: /Step 1: Verify KYC. Status: Completed/i })).toBeInTheDocument();
    });

    // Link Account should now be Todo (Action Required)
    expect(screen.getByRole("listitem", { name: /Step 2: Link Account. Status: Action Required/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /connect account/i })).toBeInTheDocument();

    // Draw Credit remains locked because account is not linked yet
    expect(screen.getByRole("listitem", { name: /Step 3: Draw Credit. Status: Locked/i })).toBeInTheDocument();
  });

  it("unlocks Draw Credit step when KYC is approved and account is linked", async () => {
    mockKyc("approved");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([
      {
        id: "google-1",
        provider: "google",
        status: "connected",
        displayName: "Test User",
        externalId: "test@google.com",
        connectedAt: "2026-06-28T00:00:00Z",
        lastVerified: "2026-06-28T00:00:00Z",
      },
    ]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getByRole("listitem", { name: /Step 1: Verify KYC. Status: Completed/i })).toBeInTheDocument();
      expect(screen.getByRole("listitem", { name: /Step 2: Link Account. Status: Completed/i })).toBeInTheDocument();
    });

    // Draw Credit should now be Todo
    expect(screen.getByRole("listitem", { name: /Step 3: Draw Credit. Status: Action Required/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /draw funds/i })).toBeInTheDocument();
  });

  it("hides the card entirely when every step is complete", async () => {
    mockKyc("approved");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([
      {
        id: "google-1",
        provider: "google",
        status: "connected",
        displayName: "Test User",
        externalId: "test@google.com",
        connectedAt: "2026-06-28T00:00:00Z",
        lastVerified: "2026-06-28T00:00:00Z",
      },
    ]);

    renderWithRouter(<NextSteps totalAvailable={5000} totalUtilized={5000} />);

    await waitFor(() => {
      expect(screen.queryByLabelText(/loading next steps/i)).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole("heading", { name: /next steps/i }),
    ).not.toBeInTheDocument();
  });

  it("simulates clicking the KYC trigger button in the DOM when starting verification", async () => {
    mockKyc("not_started");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    // Create a dummy KYC trigger button in the DOM to check if it gets clicked
    const kycBtn = document.createElement("button");
    kycBtn.className = "kyc-trigger-btn";
    const clickSpy = vi.fn();
    kycBtn.addEventListener("click", clickSpy);
    document.body.appendChild(kycBtn);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start verification/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start verification/i }));

    expect(clickSpy).toHaveBeenCalled();

    document.body.removeChild(kycBtn);
  });

  it("pins an overdue payment step first and links it to /repay", async () => {
    mockKyc("not_started");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);
    mockLines([{ id: "CL-1", nextPaymentDate: localDateString(-3) }]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(
        screen.getByRole("listitem", { name: /Step 1: Payment Overdue. Status: Action Required/i }),
      ).toBeInTheDocument();
    });

    const repay = screen.getByRole("link", { name: /repay now/i });
    expect(repay).toHaveAttribute("href", "/repay");

    // The KYC step is pushed down to step 2 because the payment step leads.
    expect(
      screen.getByRole("listitem", { name: /Step 2: Verify KYC/i }),
    ).toBeInTheDocument();
  });

  it("shows a due-today payment step that links to /repay", async () => {
    mockKyc("not_started");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);
    mockLines([{ id: "CL-1", nextPaymentDate: localDateString(0) }]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(
        screen.getByRole("listitem", { name: /Step 1: Payment Due Today/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /repay now/i })).toHaveAttribute(
      "href",
      "/repay",
    );
  });

  it("does not surface a payment step when the next payment is in the future", async () => {
    mockKyc("not_started");
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);
    mockLines([{ id: "CL-1", nextPaymentDate: localDateString(5) }]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(screen.getByRole("listitem", { name: /Step 1: Verify KYC/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(/payment overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment due today/i)).not.toBeInTheDocument();
  });

  it("adds a risk-education step that links to the existing entry point", async () => {
    mockKyc("not_started");
    mockWalletHasIdentity(true);
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(
        screen.getByRole("listitem", { name: /Review Risk Education/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /learn more/i })).toHaveAttribute(
      "href",
      "/draw-credit?learn=1",
    );
  });

  it("dismisses the card and persists the choice for the wallet", async () => {
    mockKyc("not_started");
    mockWalletHasIdentity(true);
    vi.mocked(fetchLinkedAccounts).mockResolvedValue([]);

    renderWithRouter(<NextSteps totalAvailable={10000} totalUtilized={0} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /next steps/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /dismiss next steps/i }));

    expect(
      screen.queryByRole("heading", { name: /next steps/i }),
    ).not.toBeInTheDocument();

    expect(
      window.localStorage.getItem(
        "creditra.next_steps_dismissed.freighter:GABC123:TESTNET",
      ),
    ).toBe("true");
  });
});
