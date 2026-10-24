import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HELP_ANCHORS } from "../../content/faq";

function collectTsxFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("help-anchors static scan", () => {
  it("Scenario 7: every /help#... link across src/**/*.tsx points at a registered id in HELP_ANCHORS", () => {
    const srcDir = path.resolve(__dirname, "../..");
    const tsxFiles = collectTsxFiles(srcDir);
    const helpHashRegex = /\/help#([a-zA-Z0-9_-]+)/g;
    const foundLinks: Array<{ file: string; anchor: string }> = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, "utf8");
      let match: RegExpExecArray | null;
      while ((match = helpHashRegex.exec(content)) !== null) {
        foundLinks.push({
          file: path.relative(srcDir, file).replace(/\\/g, "/"),
          anchor: match[1],
        });
      }
    }

    expect(foundLinks.length).toBeGreaterThan(0);

    for (const { file, anchor } of foundLinks) {
      expect(
        HELP_ANCHORS.has(anchor),
        `Found unregistered /help#${anchor} link in src/${file}`,
      ).toBe(true);
    }
  });
});
