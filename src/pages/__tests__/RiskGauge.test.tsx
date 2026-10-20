/**
 * RiskGauge page — focus-visible accessibility test suite
 * Issue #602 — Add focus-visible outline on RiskGauge (v7)
 *
 * Cover:
 *  1. Renders the gauge SVG when isEmpty is false (default).
 *  2. Renders EmptyState when isEmpty is true.
 *  3. EmptyState includes the NoRiskGauge illustration, heading, and description.
 *  4. EmptyState shows "Check again" CTA when onRefresh is provided.
 *  5. EmptyState does NOT render the SVG or meta row.
 *  6. When isEmpty is false, the original gauge behaviour is preserved.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { MemoryRouter } from "react-router-dom";
import { RiskGauge } from "../RiskGauge";

// ── Helpers ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function renderGauge(props: Partial<Parameters<typeof RiskGauge>[0]> = {}) {
  return render(
    <MemoryRouter>
      <RiskGauge {...props} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RiskGauge page — main", () => {

  it("2. renders the trend meta row", () => {
    renderGauge({ score: 720, trend: "improving", lastUpdated: "2025-03-01T00:00:00Z" });
    expect(screen.getByText(/improving/i)).toBeInTheDocument();
  });

  it("3. renders KbdHint with 'Explain Risk' label and '?' key", () => {
    renderGauge({ score: 720, trend: "improving", lastUpdated: "2025-03-01T00:00:00Z" });
    expect(screen.getByText("Explain Risk")).toBeInTheDocument();
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});

// ── B. Empty state ────────────────────────────────────────────────────────────

describe("RiskGauge page — empty state", () => {
  it("4. renders EmptyState heading when isEmpty is true", () => {
    renderGauge({ isEmpty: true });
    expect(
      screen.getByRole("heading", { name: /no risk data available/i }),
    ).toBeInTheDocument();
  });

  it("5. renders description text", () => {
    renderGauge({ isEmpty: true });
    expect(
      screen.getByText(/your risk score will appear here once your credit profile has been analyzed/i),
    ).toBeInTheDocument();
  });

  it("6. does NOT render the gauge SVG when empty", () => {
    renderGauge({ isEmpty: true });
    expect(screen.queryByTestId("risk-gauge-svg")).not.toBeInTheDocument();
  });

  it("7. renders 'Check again' button and calls onRefresh when clicked", () => {
    const onRefresh = vi.fn();
    renderGauge({ isEmpty: true, onRefresh });
    const btn = screen.getByRole("button", { name: /check again/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("8. does NOT render a CTA button when onRefresh is absent", () => {
    renderGauge({ isEmpty: true });
    expect(screen.queryByRole("button", { name: /check again/i })).not.toBeInTheDocument();
  });

  it("9. renders 'Risk Score' eyebrow text", () => {
    renderGauge({ isEmpty: true });
    expect(screen.getByText("Risk Score")).toBeInTheDocument();
  });
});

// ── C. WCAG 2.1 AA — keyboard accessibility ───────────────────────────────────

describe("RiskGauge page — keyboard accessibility (WCAG 2.1 AA)", () => {
  it("10. SVG has tabIndex=0 making it keyboard-reachable", () => {
    renderGauge({ score: 720, trend: "improving", lastUpdated: "2025-03-01T00:00:00Z" });
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("tabIndex", "0");
  });

  it("11. SVG has role='img'", () => {
    renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-03-01T00:00:00Z" });
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("12. SVG has aria-labelledby pointing at a <title> with the score", () => {
    renderGauge({ score: 720, trend: "improving", lastUpdated: "2025-03-01T00:00:00Z" });
    const svg = screen.getByTestId("risk-gauge-svg");
    const labelId = svg.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    const title = document.getElementById(labelId!);
    expect(title).toBeInTheDocument();
    expect(title?.textContent).toMatch(/720/);
  });

  it("13. data-testid='risk-gauge-svg' is present on the SVG", () => {
    renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(screen.getByTestId("risk-gauge-svg")).toBeInTheDocument();
  });

  it("14. data-active-sector reflects the score band", () => {
    const { rerender } = renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("data-active-sector", "high");

    rerender(
      <MemoryRouter>
        <RiskGauge score={500} trend="stable" lastUpdated="2025-01-01T00:00:00Z" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("data-active-sector", "medium");

    rerender(
      <MemoryRouter>
        <RiskGauge score={300} trend="declining" lastUpdated="2025-01-01T00:00:00Z" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("data-active-sector", "low");
  });

  it("15. data-reduced-motion attribute is present on the SVG", () => {
    renderGauge({ score: 600, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const svg = screen.getByTestId("risk-gauge-svg");
    expect(svg.hasAttribute("data-reduced-motion")).toBe(true);
  });

  it("16. each sector <g> has role='button' and tabIndex=0", () => {
    renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const sectors = screen.getAllByRole("button");
    expect(sectors).toHaveLength(3);
    sectors.forEach((s) => expect(s).toHaveAttribute("tabIndex", "0"));
  });

  it("17. each sector has a data-sector attribute identifying its band", () => {
    const { container } = renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const ids = Array.from(container.querySelectorAll("[data-sector]")).map((el) =>
      el.getAttribute("data-sector"),
    );
    expect(ids).toContain("high");
    expect(ids).toContain("medium");
    expect(ids).toContain("low");
  });

  it("18. active sector has aria-pressed='true'; inactive sectors 'false'", () => {
    const { container } = renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(container.querySelector('[data-sector="high"]')).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-sector="medium"]')).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector('[data-sector="low"]')).toHaveAttribute("aria-pressed", "false");
  });

  it("19. Enter on the SVG fires onSectorActivate with the active sector", () => {
    const onActivate = vi.fn();
    // score=720 → high
    renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    fireEvent.keyDown(screen.getByTestId("risk-gauge-svg"), { key: "Enter", code: "Enter" });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith("high");
  });

  it("20. Space on the SVG fires onSectorActivate with the active sector", () => {
    const onActivate = vi.fn();
    // score=500 → medium
    renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    fireEvent.keyDown(screen.getByTestId("risk-gauge-svg"), { key: " ", code: "Space" });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalledWith("medium");
  });

  it("21. unrelated key on SVG does NOT fire onSectorActivate", () => {
    const onActivate = vi.fn();
    renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    fireEvent.keyDown(screen.getByTestId("risk-gauge-svg"), { key: "Tab", code: "Tab" });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("22. Enter on a sector <g> fires onSectorActivate with that sector", () => {
    const onActivate = vi.fn();
    const { container } = renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    const mediumSector = container.querySelector('[data-sector="medium"]')!;
    fireEvent.keyDown(mediumSector, { key: "Enter", code: "Enter" });
    expect(onActivate).toHaveBeenCalledWith("medium");
  });

  it("23. Space on a sector <g> fires onSectorActivate with that sector", () => {
    const onActivate = vi.fn();
    const { container } = renderGauge({ score: 300, trend: "declining", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    const lowSector = container.querySelector('[data-sector="low"]')!;
    fireEvent.keyDown(lowSector, { key: " ", code: "Space" });
    expect(onActivate).toHaveBeenCalledWith("low");
  });

  it("24. clicking a sector fires onSectorActivate", () => {
    const onActivate = vi.fn();
    const { container } = renderGauge({ score: 720, trend: "improving", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    const highSector = container.querySelector('[data-sector="high"]')!;
    fireEvent.click(highSector);
    expect(onActivate).toHaveBeenCalledWith("high");
  });

  it("25. unrelated key on a sector does NOT fire onSectorActivate", () => {
    const onActivate = vi.fn();
    const { container } = renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", onSectorActivate: onActivate });
    const highSector = container.querySelector('[data-sector="high"]')!;
    fireEvent.keyDown(highSector, { key: "Escape", code: "Escape" });
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("26. onSectorActivate is optional — no throw on Enter or click", () => {
    const { container } = renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const svg = screen.getByTestId("risk-gauge-svg");
    const sector = container.querySelector('[data-sector="high"]')!;
    expect(() => fireEvent.keyDown(svg, { key: "Enter" })).not.toThrow();
    expect(() => fireEvent.click(sector)).not.toThrow();
  });

  it("27. sectors are NOT rendered when showSectors=false", () => {
    renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z", showSectors: false });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("28. sectors render by default (showSectors defaults true)", () => {
    renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});

// ── D. Focus-visible CSS token wiring (source assertions) ─────────────────────
//
// jsdom does not execute a real CSS cascade, so we assert directly against the
// stylesheet source — the same technique used in the rest of this repo for
// CSS regression guards.

describe("RiskGauge page — focus-visible CSS token wiring", () => {
  const focusCssPath = resolve(__dirname, "../../styles/focus.css");
  const focusCss = readFileSync(focusCssPath, "utf-8");

  it("29. focus.css declares --focus-ring-color token", () => {
    expect(focusCss).toMatch(/--focus-ring-color\s*:/);
  });

  it("30. focus.css declares --focus-ring-width at 2px (WCAG 2.4.11 minimum)", () => {
    expect(focusCss).toMatch(/--focus-ring-width\s*:\s*2px/);
  });

  it("31. focus.css declares --focus-ring-offset token", () => {
    expect(focusCss).toMatch(/--focus-ring-offset\s*:/);
  });

  it("32. .risk-gauge-svg:focus-visible uses box-shadow (not outline)", () => {
    // Extract the rule block for .risk-gauge-svg:focus-visible
    const ruleMatch = focusCss.match(/\.risk-gauge-svg:focus-visible\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    const ruleBody = ruleMatch![1];
    expect(ruleBody).toMatch(/box-shadow/);
    // Must NOT apply a plain outline: … value (outline: none is acceptable)
    const outlineMatch = ruleBody.match(/outline\s*:\s*([^;]+)/);
    if (outlineMatch) {
      // The only allowed outline value in this block is 'none'
      expect(outlineMatch[1].trim()).toBe("none");
    }
  });

  it("33. box-shadow in .risk-gauge-svg:focus-visible references --focus-ring-color token", () => {
    const ruleMatch = focusCss.match(/\.risk-gauge-svg:focus-visible\s*\{([^}]+)\}/);
    expect(ruleMatch).toBeTruthy();
    expect(ruleMatch![1]).toMatch(/var\(--focus-ring-color/);
  });

  it("34. .risk-gauge-sector:focus-visible .risk-gauge-sector-focus-rect reveals stroke", () => {
    expect(focusCss).toMatch(
      /\.risk-gauge-sector:focus-visible\s+\.risk-gauge-sector-focus-rect\s*\{[^}]*stroke\s*:\s*var\(--focus-ring-color/,
    );
  });

  it("35. no bare :focus rules exist in focus.css (only :focus-visible / :focus-within)", () => {
    // Plain :focus (without -visible or -within suffix) must not define any
    // outline or box-shadow rule — it would show the ring on mouse click.
    const bareMatches = focusCss.match(/:focus(?!-visible)(?!-within)\b/g);
    expect(bareMatches ?? []).toHaveLength(0);
  });

  it("36. high-contrast override sets --focus-ring-color to #ffffff", () => {
    expect(focusCss).toMatch(
      /\[data-contrast="high"\]\s*\{[^}]*--focus-ring-color\s*:\s*#ffffff/,
    );
  });

  it("37. reduced-motion block in focus.css does NOT suppress focus rings", () => {
    const rmIdx = focusCss.indexOf("@media (prefers-reduced-motion: reduce)");
    if (rmIdx === -1) return; // block absent is fine
    // Find the closing brace
    const blockStart = focusCss.indexOf("{", rmIdx);
    let depth = 0;
    let blockEnd = blockStart;
    for (let i = blockStart; i < focusCss.length; i++) {
      if (focusCss[i] === "{") depth++;
      if (focusCss[i] === "}") { depth--; if (depth === 0) { blockEnd = i; break; } }
    }
    const rmBlock = focusCss.slice(blockStart, blockEnd);
    expect(rmBlock).not.toMatch(/outline/);
    expect(rmBlock).not.toMatch(/box-shadow/);
  });
});

// ── E. Mouse click — focus ring suppression (structural) ──────────────────────

describe("RiskGauge page — mouse click does not trigger focus ring", () => {
  it("38. focus.css uses :focus-visible (not :focus) for the gauge ring, so mouse clicks never show the ring", () => {
    const focusCssPath = resolve(__dirname, "../../styles/focus.css");
    const focusCss = readFileSync(focusCssPath, "utf-8");
    // The selector must be :focus-visible, not plain :focus
    expect(focusCss).toContain(".risk-gauge-svg:focus-visible");
    // There must be no `.risk-gauge-svg:focus {` rule that would apply on click
    expect(focusCss).not.toMatch(/\.risk-gauge-svg:focus\s*\{/);
  });
});

// ── F. SR live region ──────────────────────────────────────────────────────────

describe("RiskGauge page — screen-reader live region", () => {
  it("39. aria-live='polite' region is present", () => {
    renderGauge({ score: 600, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(document.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it("40. activating a sector updates the live region message", () => {
    const { container } = renderGauge({ score: 500, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const mediumSector = container.querySelector('[data-sector="medium"]')!;
    fireEvent.click(mediumSector);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toMatch(/Activated Medium score zone/i);
  });
});

// ── G. SR-only table ──────────────────────────────────────────────────────────

describe("RiskGauge page — SR-only table", () => {
  it("41. SR table is rendered by default", () => {
    const { container } = renderGauge({ score: 600, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    expect(container.querySelector('table[aria-label="Risk score band breakdown"]')).toBeInTheDocument();
  });

  it("42. SR table is omitted when showSRTable=false", () => {
    const { container } = renderGauge({
      score: 600,
      trend: "stable",
      lastUpdated: "2025-01-01T00:00:00Z",
      showSRTable: false,
    });
    expect(container.querySelector('table[aria-label="Risk score band breakdown"]')).not.toBeInTheDocument();
  });

  it("43. SR table marks the current band with aria-current='true'", () => {
    // score=720 → high band
    const { container } = renderGauge({ score: 720, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const currentRow = container.querySelector('tr[aria-current="true"]');
    expect(currentRow).toBeInTheDocument();
    expect(currentRow?.textContent).toMatch(/High score zone/i);
  });
});

// ── H. Focus-rect element ──────────────────────────────────────────────────────

describe("RiskGauge page — sector focus-rect element", () => {
  it("44. each sector contains a .risk-gauge-sector-focus-rect <rect>", () => {
    const { container } = renderGauge({ score: 600, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
    const sectors = container.querySelectorAll("[data-sector]");
    expect(sectors).toHaveLength(3);
    sectors.forEach((sector) => {
      const focusRect = sector.querySelector(".risk-gauge-sector-focus-rect");
      expect(focusRect).toBeInTheDocument();
      expect(focusRect?.tagName.toLowerCase()).toBe("rect");
    });
  });
});

// ── I. data-active-sector boundary values ─────────────────────────────────────

describe("RiskGauge page — data-active-sector boundary values", () => {
  const cases: Array<[number, "low" | "medium" | "high"]> = [
    [0,    "low"],
    [424,  "low"],
    [425,  "medium"],
    [594,  "medium"],
    [595,  "high"],
    [850,  "high"],
    [9999, "high"],  // clamped to 850 → high
    [-1,   "low"],   // clamped to 0   → low
  ];

  cases.forEach(([score, expected]) => {
    it(`45-52. score=${score} → data-active-sector="${expected}"`, () => {
      renderGauge({ score, trend: "stable", lastUpdated: "2025-01-01T00:00:00Z" });
      expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute(
        "data-active-sector",
        expected,
      );
    });
  });
});

// ── J. Re-render consistency ──────────────────────────────────────────────────

describe("RiskGauge page — re-render consistency", () => {
  it("53. data-active-sector and aria-pressed update correctly on score change", () => {
    const { rerender, container } = render(
      <MemoryRouter>
        <RiskGauge score={300} trend="declining" lastUpdated="2025-01-01T00:00:00Z" />
      </MemoryRouter>,
    );

    // Initial: low
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("data-active-sector", "low");
    expect(container.querySelector('[data-sector="low"]')).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-sector="high"]')).toHaveAttribute("aria-pressed", "false");

    // Update: high
    rerender(
      <MemoryRouter>
        <RiskGauge score={720} trend="improving" lastUpdated="2025-01-01T00:00:00Z" />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("risk-gauge-svg")).toHaveAttribute("data-active-sector", "high");
    expect(container.querySelector('[data-sector="high"]')).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelector('[data-sector="low"]')).toHaveAttribute("aria-pressed", "false");
  });
});
