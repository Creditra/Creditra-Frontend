/**
 * RiskGauge — high-contrast (`prefers-contrast: more`) regression tests.
 *
 * Issue #851: RiskGauge must respond to the OS-level `prefers-contrast: more`
 * media query with explicit border + text overrides.
 *
 * Two things are verified:
 *
 * 1. The overrides increase real WCAG contrast. Promoting the `--muted` caption
 *    text and the low-contrast `--border` track stroke to `--text` must yield a
 *    strictly higher ratio against the background — and clear the AAA (7:1) bar.
 *    (Color math mirrors ProgressBar.contrast / ToastContainer.contrast tests.)
 *
 * 2. The CSS actually ships the `@media (prefers-contrast: more)` block with the
 *    expected border + text declarations. jsdom does not evaluate media queries
 *    or load CSS files into computed styles, so the rule is asserted against the
 *    stylesheet source — the same approach used for other CSS-only guarantees.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// ─── Color math (WCAG 2.x) ────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(hexToRgb(fgHex));
  const l2 = luminance(hexToRgb(bgHex));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Design tokens (mirror src/index.css).
const TOKEN = {
  bg: "#0d1117", // --bg
  border: "#30363d", // --border (default track stroke)
  text: "#e6edf3", // --text (high-contrast override target)
  muted: "#8b949e", // --muted (default caption/meta text)
} as const;

// ─── Stylesheet source ────────────────────────────────────────────────────────

const cssPath = join(dirname(fileURLToPath(import.meta.url)), "RiskGauge.css");
const css = readFileSync(cssPath, "utf8");

/** Extract the body of the `@media (prefers-contrast: more)` block via brace matching. */
function highContrastBlock(source: string): string {
  const marker = source.match(/@media\s*\(\s*prefers-contrast\s*:\s*more\s*\)\s*\{/);
  if (!marker || marker.index === undefined) return "";
  let depth = 0;
  const start = marker.index + marker[0].length;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      if (depth === 0) return source.slice(start, i);
      depth--;
    }
  }
  return "";
}

const block = highContrastBlock(css);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("RiskGauge — prefers-contrast: more contrast gains", () => {
  it("promoting muted caption text to --text strictly increases contrast and clears AAA", () => {
    const before = contrastRatio(TOKEN.muted, TOKEN.bg);
    const after = contrastRatio(TOKEN.text, TOKEN.bg);
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThanOrEqual(7); // WCAG AAA normal text
  });

  it("promoting the track border to --text makes the near-invisible track clearly visible", () => {
    const before = contrastRatio(TOKEN.border, TOKEN.bg);
    const after = contrastRatio(TOKEN.text, TOKEN.bg);
    expect(before).toBeLessThan(3); // default track fails UI-component contrast
    expect(after).toBeGreaterThanOrEqual(3); // override clears the 3:1 UI-component bar
  });
});

describe("RiskGauge — prefers-contrast: more stylesheet rule", () => {
  it("ships a @media (prefers-contrast: more) block", () => {
    expect(block.length).toBeGreaterThan(0);
  });

  it("overrides the track border stroke to --text with a thicker width", () => {
    expect(block).toMatch(/\.risk-gauge-bg\s*\{[^}]*stroke:\s*var\(--text\)/);
    expect(block).toMatch(/\.risk-gauge-bg\s*\{[^}]*stroke-width:\s*12/);
  });

  it("raises risk-band arc opacity so band boundaries are visible", () => {
    expect(block).toMatch(/\.risk-gauge-sector-arc\s*\{[^}]*opacity:\s*0?\.6/);
  });

  it("promotes the muted caption text to --text", () => {
    expect(block).toMatch(/\.risk-gauge-label\s*\{[^}]*fill:\s*var\(--text\)/);
  });

  it("promotes the muted meta labels to --text", () => {
    expect(block).toMatch(/\.rm-label\s*\{[^}]*color:\s*var\(--text\)/);
  });
});
