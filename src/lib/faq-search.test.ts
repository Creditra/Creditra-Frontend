import { describe, expect, it } from 'vitest';
import { FAQ, type FaqEntry } from '../content/faq';
import { normalizeText, searchFaq } from './faq-search';

describe('faq-search module', () => {
  it('normalizes diacritics, case, and whitespace', () => {
    expect(normalizeText('  conéctar   WALLET  ')).toBe('conectar wallet');
    expect(normalizeText('CRÉDITRA')).toBe('creditra');
    expect(normalizeText('re-débit   lines')).toBe('re-debit lines');
  });

  it('matches "wallet connect" regardless of token order (Scenario 1 & 2)', () => {
    const results1 = searchFaq(FAQ, 'wallet connect');
    const results2 = searchFaq(FAQ, 'CONNECT   Wallet');

    expect(results1.length).toBeGreaterThan(0);
    expect(results1[0].id).toBe('connect-wallet');
    expect(results1.map((f) => f.id)).toEqual(results2.map((f) => f.id));
  });

  it('performs accent-insensitive matching (Scenario 3)', () => {
    const testEntries: FaqEntry[] = [
      {
        id: 'test-spanish',
        sectionId: 'wallet',
        question: 'Como conectar una billetera',
        answer: 'Pasos para conectar tu billetera Stellar',
        tags: ['billetera', 'conectar'],
      },
    ];

    const results = searchFaq(testEntries, 'conéctar');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('test-spanish');
  });

  it('returns no results when a token is not found (Scenario 4)', () => {
    const results = searchFaq(FAQ, 'wallet zzzz');
    expect(results.length).toBe(0);
  });

  it('ranks question matches before answer-only matches (Scenario 5)', () => {
    const customEntries: FaqEntry[] = [
      {
        id: 'answer-only-match',
        sectionId: 'getting-started',
        question: 'What is Creditra?',
        answer: 'Creditra works seamlessly with your connected wallet.',
        tags: ['general'],
      },
      {
        id: 'question-match',
        sectionId: 'wallet',
        question: 'How do I connect a wallet?',
        answer: 'Approve the prompt in Freighter or another extension.',
        tags: ['wallet'],
      },
    ];

    const results = searchFaq(customEntries, 'connect wallet');
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('question-match');
    expect(results[1].id).toBe('answer-only-match');
  });

  it('preserves original order for items with equal match rank', () => {
    const results = searchFaq(FAQ, '');
    expect(results.map((f) => f.id)).toEqual(FAQ.map((f) => f.id));
  });

  it('caps search query at 200 characters', () => {
    const longQuery = 'wallet ' + 'a'.repeat(300);
    // Should not throw or crash
    const results = searchFaq(FAQ, longQuery);
    expect(Array.isArray(results)).toBe(true);
  });

  it('matches on tags and section titles', () => {
    const byTag = searchFaq(FAQ, 'freighter');
    expect(byTag.some((f) => f.id === 'connect-wallet')).toBe(true);

    const bySection = searchFaq(FAQ, 'Transactions');
    expect(bySection.some((f) => f.sectionId === 'transactions')).toBe(true);
  });

  it('verifies content integrity: every FAQ sectionId exists in valid sections (Scenario 10)', () => {
    const validSections = new Set([
      'getting-started',
      'wallet',
      'credit-lines',
      'transactions',
      'notifications',
      'shortcuts',
    ]);

    for (const entry of FAQ) {
      expect(
        validSections.has(entry.sectionId),
        `FAQ "${entry.id}" has invalid sectionId "${entry.sectionId}"`,
      ).toBe(true);
      expect(entry.question.trim().length).toBeGreaterThan(0);
      expect(entry.answer.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(entry.tags)).toBe(true);
    }
  });
});
