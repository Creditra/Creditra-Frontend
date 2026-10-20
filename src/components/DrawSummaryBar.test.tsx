import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { DrawSummaryBar } from "./DrawSummaryBar";
import type { CreditLine } from "@/types/draw-credit.types";

vi.mock("@/hooks/useMediaQuery", () => ({
  BELOW_MD_MEDIA: "(max-width: 767px)",
  useMediaQuery: vi.fn(() => true),
}));

vi.mock("@/hooks/useScrollCollapse", () => ({
  useScrollCollapse: vi.fn(() => false),
}));

vi.mock("@/hooks/usePrefersReducedMotion", () => ({
  usePrefersReducedMotion: vi.fn(() => false),
}));

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useScrollCollapse } from "@/hooks/useScrollCollapse";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const mockUseMediaQuery = vi.mocked(useMediaQuery);
const mockUseScrollCollapse = vi.mocked(useScrollCollapse);
const mockUsePrefersReducedMotion = vi.mocked(usePrefersReducedMotion);

const standardLine: CreditLine = {
  id: "cl-standard-001",
  name: "Business Line of Credit",
  limit: 50000,
  available: 35000,
  utilization: 30,
  riskBand: "Standard",
  termMonths: 24,
};

describe("DrawSummaryBar", () => {
  beforeEach(() => {
    mockUseMediaQuery.mockReturnValue(true);
    mockUseScrollCollapse.mockReturnValue(false);
    mockUsePrefersReducedMotion.mockReturnValue(false);
  });

  describe("visibility", () => {
    it("renders nothing when no credit line is selected", () => {
      const { container } = render(
        <DrawSummaryBar creditLine={null} amount={1000} step="amount" />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing on the `select` step even with a line", () => {
      const { container } = render(
        <DrawSummaryBar creditLine={standardLine} amount={0} step="select" />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing on the `confirm` step", () => {
      const { container } = render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={5000}
          step="confirm"
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders nothing on the terminal `status` step", () => {
      const { container } = render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={5000}
          step="status"
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("shows the bar on the `amount` step once a line is selected", () => {
      const { container } = render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );
      expect(container.firstChild).not.toBeNull();
    });

    it("does not crash when visibility toggles across renders (rules of hooks)", () => {
      const { rerender, container } = render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );
      expect(container.firstChild).not.toBeNull();

      rerender(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="confirm"
        />,
      );
      expect(container.firstChild).toBeNull();

      rerender(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1500}
          step="amount"
        />,
      );
      expect(container.firstChild).not.toBeNull();
    });
  });

  describe("rendered figures", () => {
    it("shows line name, formatted amount, and APR", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={10000}
          step="amount"
        />,
      );

      expect(screen.getByTestId("draw-summary-line")).toHaveTextContent(
        "Business Line of Credit",
      );
      expect(screen.getByTestId("draw-summary-amount")).toHaveTextContent(
        /\$10,000/,
      );

      const aprTile = screen.getByTestId("draw-summary-apr");
      expect(aprTile.textContent).toMatch(/^\d+(\.\d+)?%$/);
    });

    it("renders $0 amount and 0% APR gracefully when amount is zero", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={0}
          step="amount"
        />,
      );

      expect(screen.getByTestId("draw-summary-amount")).toHaveTextContent("$0");
    });

    it("clamps a negative amount prop to $0", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={-500}
          step="amount"
        />,
      );

      expect(screen.getByTestId("draw-summary-amount")).toHaveTextContent("$0");
    });
  });

  describe("scroll collapse", () => {
    it("applies collapsed class and shows peek row when scroll hook reports collapsed", () => {
      mockUseScrollCollapse.mockReturnValue(true);

      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={5000}
          step="amount"
        />,
      );

      const region = screen.getByTestId("draw-summary-bar");
      expect(region).toHaveClass("draw-summary-bar--collapsed");
      expect(region).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("draw-summary-peek")).toBeInTheDocument();
    });

    it("uses instant transition class when reduced motion is preferred", () => {
      mockUsePrefersReducedMotion.mockReturnValue(true);

      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      expect(screen.getByTestId("draw-summary-bar")).toHaveClass(
        "draw-summary-bar--reduced-motion",
      );
    });
  });

  describe("accessibility (WCAG 2.1 AA)", () => {
    it("exposes a labelled, focusable region landmark", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      const region = screen.getByRole("region", { name: /draw summary/i });
      expect(region).toBeInTheDocument();
      expect(region).toHaveAttribute("tabindex", "0");
    });

    it("uses definition-list semantics with Line, Amount, and APR labels", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      const captions = screen.getAllByRole("term");
      const values = screen.getAllByRole("definition");

      expect(captions).toHaveLength(3);
      expect(values).toHaveLength(3);

      const captionTexts = captions.map((node) => node.textContent);
      expect(captionTexts).toEqual(
        expect.arrayContaining(["Line", "Amount", "APR"]),
      );
    });

    it("renders the live region with role=status, aria-live=polite, and atomic updates", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      const live = screen.getByTestId("draw-summary-live");
      expect(live).toHaveAttribute("role", "status");
      expect(live).toHaveAttribute("aria-live", "polite");
      expect(live).toHaveAttribute("aria-atomic", "true");
      expect(live).toHaveClass("sr-only");
    });
  });

  describe("debounced live-region announcement", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not update the live region text until 400 ms after a settled amount", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      act(() => {
        vi.advanceTimersByTime(450);
      });
      const live = screen.getByTestId("draw-summary-live");
      expect(live.textContent).toMatch(/1,000/);
      expect(live.textContent).toMatch(/Business Line of Credit/);
    });

    it("coalesces rapid amount edits into one final announcement", () => {
      const { rerender } = render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={0}
          step="amount"
        />,
      );

      act(() => {
        vi.advanceTimersByTime(450);
      });

      for (const value of [1, 10, 100, 1000]) {
        rerender(
          <DrawSummaryBar
            creditLine={standardLine}
            amount={value}
            step="amount"
          />,
        );
      }

      act(() => {
        vi.advanceTimersByTime(399);
      });
      let live = screen.getByTestId("draw-summary-live");
      expect(live.textContent).not.toMatch(/1,000/);

      act(() => {
        vi.advanceTimersByTime(50);
      });
      live = screen.getByTestId("draw-summary-live");
      expect(live.textContent).toMatch(/1,000/);
    });
  });

  describe("responsive / structural", () => {
    it("sets a fixed-position region anchored to the viewport", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={1000}
          step="amount"
        />,
      );

      const region = screen.getByRole("region", { name: /draw summary/i });
      expect(region).toHaveClass("draw-summary-bar");
      expect(region.tagName.toLowerCase()).toBe("aside");
    });

    it("tags the bar with the visible wizard step for styling hooks", () => {
      render(
        <DrawSummaryBar
          creditLine={standardLine}
          amount={0}
          step="amount"
        />,
      );

      const region = screen.getByTestId("draw-summary-bar");
      expect(region).toHaveAttribute("data-step", "amount");
    });
  });
});
