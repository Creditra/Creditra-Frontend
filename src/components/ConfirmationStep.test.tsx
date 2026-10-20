import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConfirmationStep } from "./ConfirmationStep";
import { useWallet } from "@/context/WalletContext";
import { getDrawPricingQuote } from "@/lib/draw-credit-pricing";

// Mock WalletContext — ConfirmationStep reads wallet status to show a hint
vi.mock("@/context/WalletContext", () => ({
  useWallet: vi.fn(),
}));

// Mock draw pricing — tests focus on UI structure, not pricing arithmetic
vi.mock("@/lib/draw-credit-pricing", () => ({
  getDrawPricingQuote: vi.fn(() => ({
    fee: 100,
    apr: 12.5,
    estimatedMonthlyInterest: 104.17,
    riskBand: "Standard",
    termMonths: 24,
    utilizationAdjustmentLabel: "Low utilization adjustment",
    termAdjustmentLabel: "Standard-term pricing adjustment",
  })),
}));

const mockGetDrawPricingQuote = vi.mocked(getDrawPricingQuote);

const mockUseWallet = vi.mocked(useWallet);

const creditLine = {
  id: "cl-001",
  name: "Business Line of Credit",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard" as const,
  termMonths: 24,
};

const watchCreditLine = {
  id: "cl-003",
  name: "Working Capital",
  limit: 75000,
  available: 12000,
  utilization: 84,
  riskBand: "Watch" as const,
  termMonths: 12,
};

/** Returns footer action buttons, excluding icon-only buttons (e.g. tooltips). */
function getActionButtons() {
  return screen.getAllByRole("button").filter(
    (btn) =>
      !btn.getAttribute("aria-label") &&
      (btn.textContent?.trim() ?? "").length > 0,
  );
}

// ── Basic render ──────────────────────────────────────────────────────────────

describe("ConfirmationStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  it("renders the Review and confirm heading", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /review and confirm/i }),
    ).toBeInTheDocument();
  });

  it("shows the draw amount", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("draw-amount-display")).toHaveTextContent(
      "$10,000.00",
    );
  });

  it("shows the estimated fee from pricing quote", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Fee comes from mocked getDrawPricingQuote → $100
    expect(screen.getByTestId("fee-display")).toHaveTextContent("$100.00");
  });

  it("shows the APR from pricing quote", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("apr-display")).toHaveTextContent("12.5%");
  });

  it("shows the estimated monthly interest", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("monthly-interest-display")).toHaveTextContent(
      "$104.17",
    );
  });
});

// ── Cost breakdown section ────────────────────────────────────────────────────

describe("ConfirmationStep — cost breakdown section", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  it("renders the 'Cost breakdown' section heading", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("region", { name: /cost breakdown/i }),
    ).toBeInTheDocument();
  });

  it("shows the new balance after fee", () => {
    // utilized = 50000 - 35000 = 15000, amount = 10000, fee = 100
    // newBalance = 15000 + 10000 + 100 = 25100
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("new-balance-display")).toHaveTextContent(
      "$25,100.00",
    );
  });

  it("shows term in months", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("24 months")).toBeInTheDocument();
  });
});

// ── Risk-band badge ───────────────────────────────────────────────────────────

describe("ConfirmationStep — risk-band badge", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  it("renders a risk-band badge", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const badge = screen.getByTestId("risk-band-badge");
    expect(badge).toBeInTheDocument();
  });

  it("risk-band badge shows 'Standard band' for Standard risk line", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("risk-band-badge")).toHaveTextContent(
      "Standard band",
    );
  });

  it("risk-band badge has accessible aria-label describing the band", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const badge = screen.getByTestId("risk-band-badge");
    expect(badge).toHaveAttribute("aria-label", expect.stringMatching(/risk band: standard/i));
  });
});

// ── Watch-band risk-adjusted fee notice ───────────────────────────────────────

describe("ConfirmationStep — Watch-band risk fee notice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ status: "connected" });
    // Return Watch risk band from pricing
    mockGetDrawPricingQuote.mockReturnValue({
      fee: 50,
      apr: 14.5,
      estimatedMonthlyInterest: 60.42,
      riskBand: "Watch",
      termMonths: 12,
      utilizationAdjustmentLabel: "High utilization adjustment",
      termAdjustmentLabel: "Short-term pricing adjustment",
    });
  });

  it("shows the risk-adjusted fee notice for Watch-band credit lines", () => {
    render(
      <ConfirmationStep
        creditLine={watchCreditLine}
        amount={5000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("risk-fee-notice")).toBeInTheDocument();
    expect(screen.getByTestId("risk-fee-notice")).toHaveTextContent(
      /risk-adjusted pricing/i,
    );
  });

  it("does NOT show the risk-adjusted fee notice for Standard-band lines", () => {
    // Restore Standard mock for this test
    mockGetDrawPricingQuote.mockReturnValue({
      fee: 100,
      apr: 12.5,
      estimatedMonthlyInterest: 104.17,
      riskBand: "Standard",
      termMonths: 24,
      utilizationAdjustmentLabel: "Low utilization adjustment",
      termAdjustmentLabel: "Standard-term pricing adjustment",
    });

    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("risk-fee-notice")).not.toBeInTheDocument();
  });
});

// ── APR disclosure collapsible ────────────────────────────────────────────────

describe("ConfirmationStep — APR disclosure collapsible", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  function renderStep(overrides = {}) {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        {...overrides}
      />,
    );
  }

  it("renders the 'How is my APR calculated?' toggle button", () => {
    renderStep();

    expect(
      screen.getByTestId("apr-disclosure-toggle"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("apr-disclosure-toggle"),
    ).toHaveTextContent(/how is my apr calculated/i);
  });

  it("APR breakdown body is NOT visible by default (collapsed)", () => {
    renderStep();

    expect(screen.queryByTestId("apr-breakdown-body")).not.toBeInTheDocument();
  });

  it("toggle button has aria-expanded=false when collapsed", () => {
    renderStep();

    const toggle = screen.getByTestId("apr-disclosure-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("clicking the toggle reveals the APR breakdown", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    expect(screen.getByTestId("apr-breakdown-body")).toBeInTheDocument();
  });

  it("toggle button has aria-expanded=true when open", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    expect(screen.getByTestId("apr-disclosure-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows base rate, utilization adjustment, and term adjustment when open", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    expect(screen.getByTestId("apr-base-rate")).toBeInTheDocument();
    expect(screen.getByTestId("apr-utilization-adj")).toBeInTheDocument();
    expect(screen.getByTestId("apr-term-adj")).toBeInTheDocument();
    expect(screen.getByTestId("apr-total")).toBeInTheDocument();
  });

  it("total APR in breakdown matches the main APR display", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    const total = screen.getByTestId("apr-total");
    const mainApr = screen.getByTestId("apr-display");
    expect(total).toHaveTextContent("12.5%");
    expect(mainApr).toHaveTextContent("12.5%");
  });

  it("shows utilization adjustment label from pricing quote", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    expect(
      screen.getByText(/low utilization adjustment/i),
    ).toBeInTheDocument();
  });

  it("shows term adjustment label from pricing quote", async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByTestId("apr-disclosure-toggle"));

    expect(
      screen.getByText(/standard-term pricing adjustment/i),
    ).toBeInTheDocument();
  });

  it("clicking toggle again collapses the breakdown", async () => {
    const user = userEvent.setup();
    renderStep();

    const toggle = screen.getByTestId("apr-disclosure-toggle");
    await user.click(toggle);
    expect(screen.getByTestId("apr-breakdown-body")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId("apr-breakdown-body")).not.toBeInTheDocument();
  });
});

// ── Utilization progress bars ─────────────────────────────────────────────────

describe("ConfirmationStep — utilization progress bars", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  it("renders the 'Credit utilization' section", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("region", { name: /credit utilization/i }),
    ).toBeInTheDocument();
  });

  it("shows current utilization percentage", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // creditLine.utilization = 30
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("shows projected utilization after draw", () => {
    // utilized = 15000, draw = 10000, fee = 100 → newBalance = 25100
    // newUtilization = round(25100 / 50000 * 100) = 50
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId("utilization-after-pct")).toHaveTextContent(
      "50%",
    );
  });

  it("renders two accessible progressbar elements", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
  });

  it("does NOT show high-utilization warning when below 80%", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("high-utilization-warning"),
    ).not.toBeInTheDocument();
  });

  it("shows high-utilization warning when projected utilization exceeds 80%", () => {
    // For this to trigger: newBalance / limit > 0.80
    // limit=50000, utilized=15000, draw=30000, fee=100 → newBalance=45100 → 90%
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={30000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByTestId("high-utilization-warning"),
    ).toBeInTheDocument();
  });

  it("high-utilization warning has role=alert for immediate AT announcement", () => {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={30000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const warning = screen.getByTestId("high-utilization-warning");
    expect(warning).toHaveAttribute("role", "alert");
  });
});

// ── Button order tests (docs/BUTTON_ORDER.md) ────────────────────────────────

describe("ConfirmationStep — button order (docs/BUTTON_ORDER.md)", () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ status: "connected" });
  });

  function renderStep(overrides = {}) {
    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        {...overrides}
      />,
    );
  }

  it("renders Cancel before Back in the DOM", () => {
    renderStep();

    const buttons = getActionButtons();
    const cancelIdx = buttons.findIndex((b) => b.textContent?.trim() === "Cancel");
    const backIdx = buttons.findIndex((b) => b.textContent?.trim() === "Back");

    expect(cancelIdx).toBeGreaterThanOrEqual(0);
    expect(backIdx).toBeGreaterThanOrEqual(0);
    expect(cancelIdx).toBeLessThan(backIdx);
  });

  it("renders Back before the primary Draw button in the DOM", () => {
    renderStep();

    const buttons = getActionButtons();
    const backIdx = buttons.findIndex((b) => b.textContent?.trim() === "Back");
    const drawIdx = buttons.findIndex((b) => /draw/i.test(b.textContent ?? ""));

    expect(backIdx).toBeGreaterThanOrEqual(0);
    expect(drawIdx).toBeGreaterThanOrEqual(0);
    expect(backIdx).toBeLessThan(drawIdx);
  });

  it("full order: Cancel → Back → Draw", () => {
    renderStep();

    const buttons = getActionButtons();
    const cancelIdx = buttons.findIndex((b) => b.textContent?.trim() === "Cancel");
    const backIdx = buttons.findIndex((b) => b.textContent?.trim() === "Back");
    const drawIdx = buttons.findIndex((b) => /draw/i.test(b.textContent ?? ""));

    expect(cancelIdx).toBeLessThan(backIdx);
    expect(backIdx).toBeLessThan(drawIdx);
  });

  it("Draw is disabled until terms are accepted", () => {
    renderStep();

    const draw = screen.getByRole("button", { name: /draw/i });
    expect(draw).toBeDisabled();
  });

  it("Draw becomes enabled after the terms checkbox is ticked", async () => {
    const user = userEvent.setup();
    renderStep();

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(screen.getByRole("button", { name: /draw/i })).not.toBeDisabled();
  });

  it("Cancel and Back are disabled while isLoading", () => {
    renderStep({ isLoading: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("calls onCancel when Cancel is clicked", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderStep({ onCancel });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when Back is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    renderStep({ onBack });

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Draw is clicked after accepting terms", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderStep({ onConfirm });

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /draw/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

// ── Wallet signing hint ───────────────────────────────────────────────────────

describe("ConfirmationStep — wallet signing hint", () => {
  it("shows 'Your wallet will ask you to sign next' when wallet is connected", () => {
    mockUseWallet.mockReturnValue({
      status: "connected",
    });

    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/your wallet will ask you to sign next/i),
    ).toBeInTheDocument();
  });

  it("does NOT show wallet hint when wallet is disconnected", () => {
    mockUseWallet.mockReturnValue({
      status: "disconnected",
    });

    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByText(/your wallet will ask you to sign next/i),
    ).not.toBeInTheDocument();
  });

  it("does NOT show wallet hint while loading", () => {
    mockUseWallet.mockReturnValue({
      status: "connected",
    });

    render(
      <ConfirmationStep
        creditLine={creditLine}
        amount={10000}
        onConfirm={vi.fn()}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        isLoading
      />,
    );

    expect(
      screen.queryByText(/your wallet will ask you to sign next/i),
    ).not.toBeInTheDocument();
  });
});
