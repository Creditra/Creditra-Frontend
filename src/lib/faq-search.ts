import type { FaqEntry } from '../content/faq';

export const SECTION_TITLES: Record<string, string> = {
  'getting-started': 'Getting Started',
  'wallet': 'Wallet',
  'credit-lines': 'Credit Lines',
  'transactions': 'Transactions',
  'notifications': 'Notifications',
  'shortcuts': 'Shortcuts',
  'faq': 'FAQ',
};

/**
 * Normalises text by stripping combining diacritics/accents, lowercasing,
 * and collapsing consecutive whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export interface SearchFaqOptions {
  sectionTitles?: Record<string, string>;
}

/**
 * Pure, synchronous normalised search over FAQ entries.
 *
 * Rules:
 * - Query is capped at 200 characters.
 * - Accents are normalised (e.g. "conéctar" matches "conectar").
 * - Multi-token matching requires EVERY token to appear in question, answer, tags, or section title.
 * - Results are ranked: question matches appear before answer-only matches, preserving original order as tiebreaker.
 */
export function searchFaq(
  entries: FaqEntry[],
  rawQuery: string,
  options?: SearchFaqOptions
): FaqEntry[] {
  if (!entries || entries.length === 0) return [];

  const trimmedCapped = (rawQuery ?? '').slice(0, 200);
  const normalizedQuery = normalizeText(trimmedCapped);
  if (!normalizedQuery) {
    return [...entries];
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) {
    return [...entries];
  }

  const titles = options?.sectionTitles ?? SECTION_TITLES;

  type ScoredEntry = {
    entry: FaqEntry;
    index: number;
    questionMatch: boolean;
  };

  const matches: ScoredEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const qNorm = normalizeText(entry.question);
    const aNorm = normalizeText(entry.answer);
    const tagsNorm = (entry.tags || []).map((t) => normalizeText(t));
    const sectionNorm = normalizeText(titles[entry.sectionId] || entry.sectionId);

    // Every token must appear in question, answer, tags, or section title
    const matchesAllTokens = tokens.every((token) => {
      return (
        qNorm.includes(token) ||
        aNorm.includes(token) ||
        tagsNorm.some((tag) => tag.includes(token)) ||
        sectionNorm.includes(token)
      );
    });

    if (matchesAllTokens) {
      const questionMatch = tokens.every((token) => qNorm.includes(token));
      matches.push({
        entry,
        index: i,
        questionMatch,
      });
    }
  }

  // Sort: question matches first, then original order (stable sort)
  matches.sort((a, b) => {
    if (a.questionMatch && !b.questionMatch) return -1;
    if (!a.questionMatch && b.questionMatch) return 1;
    return a.index - b.index;
  });

  return matches.map((m) => m.entry);
}
