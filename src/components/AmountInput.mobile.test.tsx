import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AmountInput } from "./AmountInput";

describe("AmountInput Narrow Mobile Viewport (<=375px) Layout", () => {
  const mockCreditLine = {
    id: "cl-001",
    name: "Business Credit Line",
    limit: 50000,
    available: 20000,
    utilization: 60,
    riskBand: "Standard" as const,
    termMonths: 12,
  };

  it("ensures all buttons have at least 44px touch targets on narrow viewports", () => {
    render(
      <AmountInput
        creditLine={mockCreditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const decreaseBtn = screen.getByRole("button", { name: /decrease amount/i });
    const increaseBtn = screen.getByRole("button", { name: /increase amount/i });
    const maxBtn = screen.getByRole("button", { name: /set amount to maximum/i });
    const backBtn = screen.getByRole("button", { name: /back/i });
    const continueBtn = screen.getByRole("button", { name: /continue/i });

    // Touch targets should have min-h-[44px] and min-w-[44px]
    expect(decreaseBtn.className).toContain("min-h-[44px]");
    expect(decreaseBtn.className).toContain("min-w-[44px]");
    expect(increaseBtn.className).toContain("min-h-[44px]");
    expect(increaseBtn.className).toContain("min-w-[44px]");
    expect(maxBtn.className).toContain("min-h-[44px]");
    expect(maxBtn.className).toContain("min-w-[44px]");
    expect(backBtn.className).toContain("min-h-[44px]");
    expect(continueBtn.className).toContain("min-h-[44px]");
  });

  it("renders quick percentage preset buttons with 44px min touch height and flexible padding", () => {
    render(
      <AmountInput
        creditLine={mockCreditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const preset25 = screen.getByRole("button", { name: /25 percent/i });
    const preset100 = screen.getByRole("button", { name: /100 percent/i });

    expect(preset25.className).toContain("min-h-[44px]");
    expect(preset100.className).toContain("min-h-[44px]");
  });

  it("applies responsive flex column ordering on mobile for action buttons", () => {
    render(
      <AmountInput
        creditLine={mockCreditLine}
        onAmountChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    const backBtn = screen.getByRole("button", { name: /back/i });
    const actionsContainer = backBtn.parentElement;

    expect(actionsContainer?.className).toContain("flex-col");
    expect(actionsContainer?.className).toContain("xs:flex-row");
  });
});
