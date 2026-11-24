import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function maskLine(line) {
  return line.replace(/[^\r]/g, " ");
}

function maskFencedCode(markdown) {
  const lines = markdown.split("\n");
  const masked = [];
  let fence = null;

  for (const originalLine of lines) {
    const line = originalLine.endsWith("\r") ? originalLine.slice(0, -1) : originalLine;

    if (fence) {
      masked.push(maskLine(originalLine));
      const closingFence = new RegExp(
        `^ {0,3}${fence.character}{${fence.length},}\\s*$`,
      );
      if (closingFence.test(line)) fence = null;
      continue;
    }

    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (openingFence && !(openingFence[1][0] === "`" && openingFence[2].includes("`"))) {
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      masked.push(maskLine(originalLine));
      continue;
    }

    masked.push(originalLine);
  }

  return masked.join("\n");
}

function backtickRunLength(text, index) {
  let end = index;
  while (text[end] === "`") end += 1;
  return end - index;
}

function findClosingBacktickRun(text, start, length) {
  for (let index = start; index < text.length; ) {
    if (text[index] !== "`") {
      index += 1;
      continue;
    }

    const runLength = backtickRunLength(text, index);
    if (runLength === length) return index;
    index += runLength;
  }

  return -1;
}

function maskInlineCode(markdown) {
  const chars = markdown.split("");

  for (let index = 0; index < chars.length; ) {
    if (chars[index] !== "`" || isEscaped(markdown, index)) {
      index += 1;
      continue;
    }

    const runLength = backtickRunLength(markdown, index);
    const closingIndex = findClosingBacktickRun(markdown, index + runLength, runLength);
    if (closingIndex === -1) {
      index += runLength;
      continue;
    }

    const end = closingIndex + runLength;
    for (let maskIndex = index; maskIndex < end; maskIndex += 1) {
      if (chars[maskIndex] !== "\n" && chars[maskIndex] !== "\r") {
        chars[maskIndex] = " ";
      }
    }
    index = end;
  }

  return chars.join("");
}

function isEscaped(text, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function findClosingBracket(text, openingIndex) {
  let depth = 0;

  for (let index = openingIndex; index < text.length; index += 1) {
    if (isEscaped(text, index)) continue;
    if (text[index] === "[") depth += 1;
    if (text[index] === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function parseLinkTarget(text, openingParen) {
  let index = openingParen + 1;
  while (/\s/.test(text[index] ?? "")) index += 1;

  if (text[index] === "<") {
    const start = index + 1;
    index = start;
    while (index < text.length && (text[index] !== ">" || isEscaped(text, index))) {
      index += 1;
    }
    if (index >= text.length) return null;
    return { target: text.slice(start, index), end: index + 1 };
  }

  const start = index;
  let nestedParens = 0;
  while (index < text.length) {
    if (isEscaped(text, index)) {
      index += 1;
      continue;
    }
    if (text[index] === "(") {
      nestedParens += 1;
    } else if (text[index] === ")") {
      if (nestedParens === 0) break;
      nestedParens -= 1;
    } else if (/\s/.test(text[index]) && nestedParens === 0) {
      break;
    }
    index += 1;
  }

  if (nestedParens !== 0 || index === start) return null;
  return { target: text.slice(start, index), end: index };
}

/** Extract inline Markdown link targets, retaining their 1-based source lines. */
export function extractMarkdownLinks(markdown) {
  const searchable = maskInlineCode(maskFencedCode(markdown));
  const links = [];

  for (let index = 0; index < searchable.length; index += 1) {
    if (searchable[index] !== "[" || isEscaped(searchable, index)) continue;

    const closingBracket = findClosingBracket(searchable, index);
    if (closingBracket === -1 || searchable[closingBracket + 1] !== "(") continue;

    const parsed = parseLinkTarget(searchable, closingBracket + 1);
    if (!parsed || !parsed.target) continue;

    links.push({
      target: parsed.target,
      line: searchable.slice(0, index).split("\n").length,
    });
    index = parsed.end;
  }

  return links;
}

/** Resolve a local inline-link target against its Markdown source file. */
export function resolveRelativeLink(sourceFile, target) {
  const normalizedTarget = target.trim();
  if (
    !normalizedTarget ||
    normalizedTarget.startsWith("#") ||
    /^https?:/i.test(normalizedTarget) ||
    /^mailto:/i.test(normalizedTarget)
  ) {
    return null;
  }

  const pathTarget = normalizedTarget.split(/[?#]/, 1)[0];
  if (!pathTarget) return null;

  return path.resolve(
    path.dirname(sourceFile),
    decodeURIComponent(pathTarget),
  );
}

/** Find missing local targets in a Markdown string. */
export function findBrokenMarkdownLinks(markdown, sourceFile, fileExists = existsSync) {
  const brokenLinks = [];

  for (const link of extractMarkdownLinks(markdown)) {
    try {
      const resolved = resolveRelativeLink(sourceFile, link.target);
      if (resolved && !fileExists(resolved)) brokenLinks.push(link);
    } catch {
      brokenLinks.push(link);
    }
  }

  return brokenLinks;
}

export function collectMarkdownFiles(rootDirectory) {
  const files = [];
  const readme = path.join(rootDirectory, "README.md");
  if (existsSync(readme)) files.push(readme);

  const docsDirectory = path.join(rootDirectory, "docs");
  if (!existsSync(docsDirectory)) return files;

  const pendingDirectories = [docsDirectory];
  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

export function checkDocumentationLinks(rootDirectory = process.cwd()) {
  const failures = [];

  for (const file of collectMarkdownFiles(rootDirectory)) {
    const contents = readFileSync(file, "utf8");
    for (const link of findBrokenMarkdownLinks(contents, file)) {
      failures.push({ file, ...link });
    }
  }

  return failures;
}

function runCli() {
  const rootDirectory = process.cwd();
  const failures = checkDocumentationLinks(rootDirectory);

  for (const failure of failures) {
    const sourceFile = path.relative(rootDirectory, failure.file).split(path.sep).join("/");
    console.error(`${sourceFile}:${failure.line} -> ${failure.target}`);
  }

  if (failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli();
}
