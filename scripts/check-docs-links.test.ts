import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractMarkdownLinks,
  findBrokenMarkdownLinks,
  resolveRelativeLink,
} from "./check-docs-links.mjs";

const temporaryDirectories: string[] = [];
const checkerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-docs-links.mjs");

function createTemporaryDirectory() {
  const directory = mkdtempSync(path.join(os.tmpdir(), "docs-link-checker-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("docs link checker", () => {
  it("extracts inline links while ignoring fenced and inline code", () => {
    const links = extractMarkdownLinks([
      "[valid](./valid.md)",
      "`[inline](./inline.md)`",
      "```md",
      "[fenced](./fenced.md)",
      "```",
      "~~~",
      "[tilde fenced](./tilde.md)",
      "~~~",
      "[broken](./broken.md)",
    ].join("\n"));

    expect(links).toEqual([
      { target: "./valid.md", line: 1 },
      { target: "./broken.md", line: 9 },
    ]);
  });

  it("resolves URL-encoded paths after stripping queries and fragments", () => {
    const root = createTemporaryDirectory();
    const sourceDirectory = path.join(root, "docs");
    const designDirectory = path.join(root, "Design System");
    mkdirSync(sourceDirectory);
    mkdirSync(designDirectory);
    const sourceFile = path.join(sourceDirectory, "ARCHITECTURE.md");
    const targetFile = path.join(designDirectory, "tokens.md");
    writeFileSync(targetFile, "");

    expect(
      resolveRelativeLink(
        sourceFile,
        "../Design%20System/tokens.md?view=full#colors",
      ),
    ).toBe(targetFile);
    expect(
      findBrokenMarkdownLinks(
        "[tokens](../Design%20System/tokens.md?view=full#colors)",
        sourceFile,
      ),
    ).toEqual([]);
  });

  it("accepts links to directories and skips anchors and external URLs", () => {
    const root = createTemporaryDirectory();
    const sourceFile = path.join(root, "README.md");
    const directoryTarget = path.join(root, "docs");
    mkdirSync(directoryTarget);

    expect(
      findBrokenMarkdownLinks(
        [
          "[directory](./docs/)",
          "[section](#overview)",
          "[external](https://example.com/missing)",
          "[email](mailto:docs@example.com)",
        ].join("\n"),
        sourceFile,
      ),
    ).toEqual([]);
  });

  it("reports missing paths and malformed encoded targets with line numbers", () => {
    const sourceFile = path.join(createTemporaryDirectory(), "README.md");

    expect(
      findBrokenMarkdownLinks(
        "[missing](./missing.md)\n[invalid encoding](./bad%ZZ.md)",
        sourceFile,
      ),
    ).toEqual([
      { target: "./missing.md", line: 1 },
      { target: "./bad%ZZ.md", line: 2 },
    ]);
  });

  it("exits with code 1 and prints the source line for a missing target", () => {
    const root = createTemporaryDirectory();
    writeFileSync(path.join(root, "README.md"), "[missing](./missing.md)\n");

    const result = spawnSync(process.execPath, [checkerPath], {
      cwd: root,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("README.md:1 -> ./missing.md");
  });
});
