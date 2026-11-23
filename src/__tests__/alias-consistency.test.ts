import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * The `@` import alias is declared in three places:
 *   - tsconfig.json         -> compilerOptions.paths["@/*"] (editor + typecheck)
 *   - vite.config.ts        -> resolve.alias["@"]           (build)
 *   - vitest.config.ts      -> resolve.alias["@"]           (tests)
 *
 * If any of them drifts to a different directory, one of the editor, the build
 * or the test run silently breaks. These tests pin all three to `<repo>/src`.
 *
 * Tradeoff: vite.config.ts and vitest.config.ts are read as text and matched
 * with a regex rather than imported. Importing them inside a Vitest run loads
 * Vite/esbuild (and, for vite.config.ts, the Tailwind plugin) into the jsdom
 * test environment, which breaks esbuild's TextEncoder invariant, and the
 * global test setup needs jsdom so the file cannot opt into the node
 * environment. The cost is that the regex expects the alias to be written as
 * `"@": path.resolve(__dirname, "<dir>")`; if the declaration is restructured
 * the test fails loudly (the match assertion) rather than passing silently.
 */

const repoRoot = resolve(__dirname, '..', '..');
const srcDir = resolve(repoRoot, 'src');

function readTsconfigAliasTarget(): string {
  // tsconfig.json is plain JSON today. Strip comments defensively so that
  // adding `//` or `/* */` comments later does not break this test.
  const raw = readFileSync(resolve(repoRoot, 'tsconfig.json'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const tsconfig = JSON.parse(raw) as {
    compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
  };
  const { baseUrl = '.', paths } = tsconfig.compilerOptions ?? {};
  const targets = paths?.['@/*'];
  expect(targets, 'tsconfig.json must define paths["@/*"]').toBeDefined();
  expect(targets).toHaveLength(1);
  // "src/*" -> "src"
  const target = (targets as string[])[0].replace(/\/\*$/, '');
  return resolve(repoRoot, baseUrl, target);
}

/**
 * Extract the directory the `@` alias points at from a Vite-style config file
 * that declares it as `"@": path.resolve(__dirname, "<dir>")`.
 */
function readAliasTargetFromConfigText(file: string): string {
  const text = readFileSync(resolve(repoRoot, file), 'utf-8');
  const match = text.match(
    /["']@["']\s*:\s*path\.resolve\(\s*__dirname\s*,\s*["']([^"']+)["']\s*\)/,
  );
  expect(
    match,
    `${file} must define the "@" alias via path.resolve(__dirname, "<dir>")`,
  ).not.toBeNull();
  return resolve(repoRoot, (match as RegExpMatchArray)[1]);
}

const readViteConfigAliasTarget = () => readAliasTargetFromConfigText('vite.config.ts');
const readVitestConfigAliasTarget = () => readAliasTargetFromConfigText('vitest.config.ts');

describe('@ alias consistency', () => {
  it('src directory exists', () => {
    expect(existsSync(srcDir)).toBe(true);
  });

  it('tsconfig.json maps @/* to the src directory', () => {
    expect(readTsconfigAliasTarget()).toBe(srcDir);
  });

  it('vite.config.ts maps @ to the src directory', () => {
    expect(readViteConfigAliasTarget()).toBe(srcDir);
  });

  it('vitest.config.ts maps @ to the src directory', () => {
    expect(readVitestConfigAliasTarget()).toBe(srcDir);
  });

  it('all three definitions resolve to the same directory', () => {
    const resolved = [
      readTsconfigAliasTarget(),
      readViteConfigAliasTarget(),
      readVitestConfigAliasTarget(),
    ];
    expect(new Set(resolved).size).toBe(1);
  });
});
