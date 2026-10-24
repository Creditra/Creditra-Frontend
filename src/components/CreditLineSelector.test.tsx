import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { CreditLineSelector } from "./CreditLineSelector";
import { createCreditLine } from "@/lib/draw-credit-mock-data";
import type { CreditLine } from "@/types/draw-credit.types";

const activeLine = createCreditLine({
  id: "cl-active",
  name: "Active Line",
  status: "Active",
  limit: 50_000,
  utilization: 30,
  riskBand: "Standard",
  termMonths: 24,
});

const frozenLine = createCreditLine({
  id: "cl-frozen",
  name: "Seasonal Inventory Line",
  status: "Frozen",
  limit: 25_000,
  utilization: 40,
  riskBand: "Standard",
  termMonths: 12,
});

function renderSelector(creditLines: CreditLine[]) {
  const onSelect = vi.fn();
  const result = render(
    <CreditLineSelector creditLines={creditLines} onSelect={onSelect} />,
  );
  return { ...result, onSelect };
}

describe("CreditLineSelector — draw eligibility", () => {
  it("renders a Frozen line disabled with the reason and an unfreeze link", () => {
    renderSelector([frozenLine]);

    const frozenButton = screen.getByRole("button", {
      name: /seasonal inventory line credit line unavailable: frozen/i,
    });

    expect(frozenButton).toHaveAttribute("aria-disabled", "true");
    expect(frozenButton).not.toBeDisabled();
    expect(frozenButton).toHaveAccessibleDescription(
      /frozen — unfreeze on credit lines/i,
    );

    const unfreezeLink = screen.getByRole("link", {
      name: /frozen — unfreeze on credit lines/i,
    });
    expect(unfreezeLink).toHaveAttribute(
      "href",
      "/credit-lines?highlight=cl-frozen",
    );
  });

  it("does not select an ineligible line on click or Enter", async () => {
    const user = userEvent.setup({ delay: null });
    const { onSelect } = renderSelector([frozenLine]);

    const frozenButton = screen.getByRole("button", {
      name: /seasonal inventory line credit line unavailable/i,
    });

    await user.click(frozenButton);
    frozenButton.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("lists eligible lines before ineligible ones", () => {
    renderSelector([frozenLine, activeLine]);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName(/select active line credit line/i);
    expect(buttons[buttons.length - 1]).toHaveAccessibleName(
      /seasonal inventory line credit line unavailable/i,
    );
  });

  it("passes an axe audit with an ineligible line", async () => {
    const { container } = renderSelector([activeLine, frozenLine]);

    const results = await axe.run(container);

    expect(results.violations).toHaveLength(0);
  });
});
