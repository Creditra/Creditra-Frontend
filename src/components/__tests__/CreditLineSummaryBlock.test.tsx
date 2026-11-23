import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CreditLineSummaryBlock } from "../CreditLineSummaryBlock";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";
import { getDrawPricingQuote } from "@/lib/draw-credit-pricing";
import { projectDraw } from "@/lib/draw-projection";
import { formatMoney } from "@/utils/amountValidation";
import type { CreditLine } from "@/types/draw-credit.types";

const baseLine: CreditLine = mockCreditLines[0];

function getMetricCard(label: "Limit" | "Utilized" | "Available") {
  const labelEl = screen.getByText(label);
  const card = labelEl.parentElement;
  if (!card) {
    throw new Error(`Expected metric card container for "${label}"`);
  }
  return within(card);
}

describe("CreditLineSummaryBlock", () => {
  it("renders limit, utilized, and available formatted with formatMoney by default", () => {
    const { container } = render(
      <CreditLineSummaryBlock creditLine={baseLine} />,
    );

    expect(
      screen.getByRole("heading", { name: /credit summary/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(baseLine.name)).toBeInTheDocument();

    const expectedUtilized = baseLine.limit - baseLine.available;
    expect(
      getMetricCard("Limit").getByText(formatMoney(baseLine.limit)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Utilized").getByText(formatMoney(expectedUtilized)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Available").getByText(formatMoney(baseLine.available)),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("shows projected utilized and available balances when amount > 0", () => {
    const drawAmount = 10000;
    const projection = projectDraw(
      baseLine,
      drawAmount,
      getDrawPricingQuote(baseLine, drawAmount),
    );

    const { container } = render(
      <CreditLineSummaryBlock creditLine={baseLine} amount={drawAmount} />,
    );

    expect(
      getMetricCard("Limit").getByText(formatMoney(baseLine.limit)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Utilized").getByText(formatMoney(projection.newBalance)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Available").getByText(
        formatMoney(projection.remainingAvailable),
      ),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("treats a negative amount as 0", () => {
    const { container } = render(
      <CreditLineSummaryBlock creditLine={baseLine} amount={-5000} />,
    );

    const expectedUtilized = baseLine.limit - baseLine.available;
    expect(
      getMetricCard("Limit").getByText(formatMoney(baseLine.limit)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Utilized").getByText(formatMoney(expectedUtilized)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Available").getByText(formatMoney(baseLine.available)),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("renders a zero-limit line without throwing or producing NaN/Infinity", () => {
    const zeroLimitLine: CreditLine = {
      ...baseLine,
      id: "cl-zero",
      name: "Zero Limit Line",
      limit: 0,
      available: 0,
      utilization: 0,
    };

    const { container } = render(
      <CreditLineSummaryBlock creditLine={zeroLimitLine} />,
    );

    expect(screen.getByText(zeroLimitLine.name)).toBeInTheDocument();
    expect(
      getMetricCard("Limit").getByText(formatMoney(0)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Utilized").getByText(formatMoney(0)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Available").getByText(formatMoney(0)),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("renders a fully drawn line (available: 0) accurately without NaN/Infinity", () => {
    const fullyDrawnLine: CreditLine = {
      ...baseLine,
      id: "cl-full",
      name: "Fully Drawn Line",
      limit: 50000,
      available: 0,
      utilization: 100,
    };

    const { container } = render(
      <CreditLineSummaryBlock creditLine={fullyDrawnLine} />,
    );

    expect(screen.getByText(fullyDrawnLine.name)).toBeInTheDocument();
    expect(
      getMetricCard("Limit").getByText(formatMoney(50000)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Utilized").getByText(formatMoney(50000)),
    ).toBeInTheDocument();
    expect(
      getMetricCard("Available").getByText(formatMoney(0)),
    ).toBeInTheDocument();

    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("marks the decorative accent stripe with aria-hidden=\"true\"", () => {
    const { container } = render(
      <CreditLineSummaryBlock creditLine={baseLine} />,
    );

    const section = container.querySelector("section");
    expect(section).not.toBeNull();

    const accentStripe = section?.firstElementChild;
    expect(accentStripe).not.toBeNull();
    expect(accentStripe?.tagName).toBe("SPAN");
    expect(accentStripe).toHaveAttribute("aria-hidden", "true");
  });
});
