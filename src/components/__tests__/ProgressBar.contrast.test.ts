import { describe, expect, it } from "vitest";

// ─── Color math ───────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
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

function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Design tokens (mirror src/index.css and focus.css / ProgressBar.css) ────

const TOKEN = {
  bg: "#0d1117",      // --bg
  surface: "#161b22", // --surface
  border: "#30363d",  // --border (track background)
  accent: "#58a6ff",  // --accent
  success: "#3fb950", // --success
  warning: "#d29922", // --warning
  error: "#f85149",   // --error (danger)
} as const;

const HIGH_CONTRAST_TOKEN = {
  track: "#000000",
  accent: "#85b5ff",
  success: "#56d364",
  warning: "#f2cc60",
  error: "#ff7b72",
};

describe("ProgressBar — WCAG AA/AAA contrast", () => {
  const variants = [
    { name: "accent",  color: TOKEN.accent },
    { name: "success", color: TOKEN.success },
    { name: "warning", color: TOKEN.warning },
    { name: "danger",  color: TOKEN.error },
  ];

  for (const { name, color } of variants) {
    it(`[${name}] fill meets AA UI component contrast (≥ 3.0:1) against track background (${TOKEN.border})`, () => {
      const ratio = contrastRatio(hexToRgb(color), hexToRgb(TOKEN.border));
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it(`[${name}] fill meets AA UI component contrast (≥ 3.0:1) against page background (${TOKEN.bg})`, () => {
      const ratio = contrastRatio(hexToRgb(color), hexToRgb(TOKEN.bg));
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it(`[${name}] fill meets AA UI component contrast (≥ 3.0:1) against card surface (${TOKEN.surface})`, () => {
      const ratio = contrastRatio(hexToRgb(color), hexToRgb(TOKEN.surface));
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  }

  // High contrast AAA tests (≥ 7.0:1)
  const hcVariants = [
    { name: "accent",  color: HIGH_CONTRAST_TOKEN.accent },
    { name: "success", color: HIGH_CONTRAST_TOKEN.success },
    { name: "warning", color: HIGH_CONTRAST_TOKEN.warning },
    { name: "danger",  color: HIGH_CONTRAST_TOKEN.error },
  ];

  for (const { name, color } of hcVariants) {
    it(`[${name}] high-contrast fill meets AAA contrast (≥ 7.0:1) against high-contrast track background (${HIGH_CONTRAST_TOKEN.track})`, () => {
      const ratio = contrastRatio(hexToRgb(color), hexToRgb(HIGH_CONTRAST_TOKEN.track));
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });
  }
});
