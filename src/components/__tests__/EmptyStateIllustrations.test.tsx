// src/components/__tests__/EmptyStateIllustrations.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import * as IllustrationsFromModule from "../illustrations/EmptyStateIllustrations";
import * as IllustrationsFromIndex from "../illustrations";

const illustrations = [
  { name: "NoActivity", Component: IllustrationsFromModule.NoActivity },
  { name: "NoDataGraph", Component: IllustrationsFromModule.NoDataGraph },
  { name: "NoLines", Component: IllustrationsFromModule.NoLines },
  { name: "NoOutstandingDebt", Component: IllustrationsFromModule.NoOutstandingDebt },
  { name: "NoOverdue", Component: IllustrationsFromModule.NoOverdue },
  { name: "NoRiskGauge", Component: IllustrationsFromModule.NoRiskGauge },
];

describe("EmptyStateIllustrations (#1107)", () => {
  describe("Index exports", () => {
    it("re-exports all empty state illustrations from the index barrel", () => {
      illustrations.forEach(({ name }) => {
        expect(IllustrationsFromIndex).toHaveProperty(name);
        expect(
          (IllustrationsFromIndex as Record<string, unknown>)[name]
        ).toBeTypeOf("function");
      });
    });
  });

  describe.each(illustrations)("$name illustration", ({ Component, name }) => {
    it("is hidden from assistive technology with aria-hidden='true'", () => {
      const { container } = render(<Component />);

      const frame = container.querySelector(".empty-state-illustration");
      expect(frame).toBeInTheDocument();
      expect(frame).toHaveAttribute("aria-hidden", "true");

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("ensures SVG is not focusable", () => {
      const { container } = render(<Component />);

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute("focusable", "false");

      // Verify no focusable or tabbable children exist in the illustration
      const tabbables = container.querySelectorAll("[tabindex], a, button, input");
      expect(tabbables.length).toBe(0);
    });

    it("merges additional className props onto the container frame", () => {
      const { container } = render(<Component className="custom-test-class" />);

      const frame = container.querySelector(".empty-state-illustration");
      expect(frame).toHaveClass("empty-state-illustration");
      expect(frame).toHaveClass("custom-test-class");
    });

    it("uses currentColor for stroke and fill to support high-contrast and theming", () => {
      const { container } = render(
        <div style={{ color: "rgb(88, 166, 255)" }}>
          <Component />
        </div>
      );

      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();

      // Check all elements inside svg that define stroke or fill
      const coloredElements = svg?.querySelectorAll("[stroke], [fill]");
      expect(coloredElements?.length).toBeGreaterThan(0);

      coloredElements?.forEach((el) => {
        const stroke = el.getAttribute("stroke");
        const fill = el.getAttribute("fill");

        if (stroke && stroke !== "none") {
          expect(stroke).toBe("currentColor");
        }
        if (fill && fill !== "none") {
          expect(fill).toBe("currentColor");
        }
      });
    });
  });
});
