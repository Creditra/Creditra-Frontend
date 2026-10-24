import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DrawCreditPage from "./DrawCreditPage";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";
import { loadDraft, saveDraft } from "@/state/wizardDraft";
import { __setMockLocation } from "react-router-dom";

// The wizard reads the connected wallet to scope its persisted draft. These
// tests render the page without a WalletProvider.
vi.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ wallet: null }),
  walletIdentityKey: () => null,
}));

const activeMock = mockCreditLines.find((line) => line.id === "cl-001")!;

async function goToConfirmStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: /select business line of credit/i }),
  );
  const input = screen.getByRole("spinbutton");
  await user.clear(input);
  await user.type(input, "1000");
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

describe("DrawCreditPage — draw eligibility", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("creditra.default_risk_ack", "true");
    __setMockLocation("/draw-credit");
  });

  afterEach(() => {
    activeMock.status = "Active";
  });

  it("re-checks status at submit and blocks a line that became Frozen mid-flow", async () => {
    const user = userEvent.setup({ delay: null });
    render(<DrawCreditPage />);

    await goToConfirmStep(user);
    expect(
      screen.getByRole("heading", { name: /review and confirm/i }),
    ).toBeInTheDocument();

    // The line changes status after the user chose it but before submit.
    activeMock.status = "Frozen";

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /confirm draw/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/frozen/i);
    expect(
      screen.getByRole("heading", { name: /review and confirm/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /processing/i }),
    ).not.toBeInTheDocument();
  });

  it("discards a restored draft that references a Defaulted line", () => {
    // The draft references a line that has since become Defaulted.
    activeMock.status = "Defaulted";

    saveDraft({ step: "amount", lineId: activeMock.id, amountCents: 10_000 }, null);

    render(<DrawCreditPage />);

    expect(
      screen.getByRole("heading", { name: /select credit line/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /enter amount/i }),
    ).not.toBeInTheDocument();
    expect(loadDraft()).toBeNull();
  });
});
