import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ, HELP_ANCHORS, HELP_SECTION_IDS } from "./faq";

/**
 * Schema validation for the hand-edited Help Center FAQ data.
 *
 * The FAQ array is edited by hand and rendered directly into the Help Center,
 * where each `id` is used as a DOM id and as a `#anchor` target. Nothing else
 * validates the shape of the data, so a duplicated id or an empty answer would
 * ship silently. These tests run in CI and fail on the data mistake instead.
 */

/** Ids become `#anchors` and DOM ids, so they must survive a URL fragment. */
const ANCHOR_SAFE_ID = /^[a-z0-9-]+$/;

/**
 * Entries that ship a video without a transcript. `repayments` predates the
 * transcript requirement: there is no transcript page for it under
 * https://support.creditra.app/transcripts, so inventing a URL would render a
 * broken "Read transcript" link. The exception is recorded here instead of
 * being hidden by a weaker assertion, and the test below fails if this entry
 * disappears from the FAQ (so the list cannot rot).
 */
const ENTRIES_WITHOUT_TRANSCRIPT = new Set(["repayments"]);

/**
 * The section ids HelpCenter.tsx actually renders as category cards. They are
 * read from the component's `categories` array rather than duplicated here, so
 * renaming a section in the page fails this test instead of silently leaving
 * FAQ rows without a visible category.
 */
function readHelpCenterCategoryIds(source: string): string[] {
  const block = /const categories = \[([\s\S]*?)\] as const;/.exec(source);
  if (!block) {
    throw new Error(
      "Could not read the `categories` array from src/pages/HelpCenter.tsx",
    );
  }

  return [...block[1].matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
}

const helpCenterSource = fs.readFileSync(
  path.resolve(__dirname, "../pages/HelpCenter.tsx"),
  "utf8",
);
const HELP_CENTER_SECTION_IDS = new Set(readHelpCenterCategoryIds(helpCenterSource));

const nonEmpty = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isHttpsUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

describe("FAQ data schema", () => {
  it("has entries to validate", () => {
    expect(FAQ.length).toBeGreaterThan(0);
  });

  it("ids are unique, non-empty and anchor safe", () => {
    const seen = new Set<string>();

    for (const entry of FAQ) {
      expect(nonEmpty(entry.id), `FAQ entry has an empty id`).toBe(true);
      expect(
        ANCHOR_SAFE_ID.test(entry.id),
        `FAQ id "${entry.id}" is not anchor safe (expected ${ANCHOR_SAFE_ID})`,
      ).toBe(true);
      expect(
        seen.has(entry.id),
        `Duplicate FAQ id "${entry.id}" — ids double as #anchors and DOM ids`,
      ).toBe(false);
      seen.add(entry.id);
    }
  });

  it("ids do not collide with help topic anchors", () => {
    const sectionIds = new Set<string>(HELP_SECTION_IDS);

    for (const entry of FAQ) {
      expect(
        sectionIds.has(entry.id),
        `FAQ id "${entry.id}" collides with a help section id of the same name`,
      ).toBe(false);
      expect(HELP_ANCHORS.has(entry.id), `FAQ id "${entry.id}" is not a registered help anchor`).toBe(
        true,
      );
    }
  });

  it("question, answer and sectionId are non-empty after trim", () => {
    for (const entry of FAQ) {
      expect(nonEmpty(entry.question), `FAQ "${entry.id}" has an empty question`).toBe(true);
      expect(nonEmpty(entry.answer), `FAQ "${entry.id}" has an empty answer`).toBe(true);
      expect(nonEmpty(entry.sectionId), `FAQ "${entry.id}" has an empty sectionId`).toBe(true);
    }
  });

  it("tags are a non-empty array of unique non-empty strings", () => {
    for (const entry of FAQ) {
      expect(Array.isArray(entry.tags), `FAQ "${entry.id}" tags is not an array`).toBe(true);
      expect(entry.tags.length, `FAQ "${entry.id}" has no tags`).toBeGreaterThan(0);

      const seen = new Set<string>();
      for (const tag of entry.tags) {
        expect(typeof tag, `FAQ "${entry.id}" has a non-string tag`).toBe("string");
        expect(nonEmpty(tag), `FAQ "${entry.id}" has an empty tag`).toBe(true);
        expect(seen.has(tag), `FAQ "${entry.id}" repeats the tag "${tag}"`).toBe(false);
        seen.add(tag);
      }
    }
  });

  it("every sectionId is a category rendered by HelpCenter.tsx", () => {
    expect(HELP_CENTER_SECTION_IDS.size).toBeGreaterThan(0);

    for (const entry of FAQ) {
      expect(
        HELP_CENTER_SECTION_IDS.has(entry.sectionId),
        `FAQ "${entry.id}" uses sectionId "${entry.sectionId}", which no HelpCenter category renders`,
      ).toBe(true);
    }
  });

  it("every entry with a videoId has an https transcript", () => {
    for (const entry of FAQ) {
      if (!entry.videoId) continue;
      if (ENTRIES_WITHOUT_TRANSCRIPT.has(entry.id)) continue;

      expect(
        isHttpsUrl(entry.transcriptUrl),
        `FAQ "${entry.id}" has a videoId but no https transcriptUrl`,
      ).toBe(true);
    }
  });

  it("transcriptUrl, when present, is a valid https URL", () => {
    for (const entry of FAQ) {
      if (entry.transcriptUrl === undefined) continue;

      expect(
        isHttpsUrl(entry.transcriptUrl),
        `FAQ "${entry.id}" transcriptUrl "${entry.transcriptUrl}" is not a valid https URL`,
      ).toBe(true);
    }
  });

  it("documented transcript exceptions still point at real entries", () => {
    const ids = new Set(FAQ.map((entry) => entry.id));

    for (const id of ENTRIES_WITHOUT_TRANSCRIPT) {
      expect(ids.has(id), `Documented transcript exception "${id}" is not in the FAQ`).toBe(true);
    }
  });
});
