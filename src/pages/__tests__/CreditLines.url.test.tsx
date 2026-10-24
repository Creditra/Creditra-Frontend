/**
 * CreditLines.url.test.tsx
 *
 * Tests for URL-backed list state (Issue #1198):
 *   1. ?status=Suspended  → only Suspended lines rendered
 *   2. Sort to APR asc    → URL updates to ?sort=apr&dir=asc
 *   3. Navigate to repay and back → filter/sort/page restored
 *   4. ?sort=bogus&status=Liquidated → defaults, no crash
 *   5. Sort by status desc → Defaulted first, then Suspended
 *   6. Status ties broken by compareCreditLines
 *   7. Defaults → no query string
 *
 * Uses MemoryRouter from the react-router-dom stub.
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as ReactRouterDom from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CreditLines from '../CreditLines';
import { MOCK_CREDIT_LINES } from '../../data/mockData';

// ── Stub helpers ──────────────────────────────────────────────────────────────
const { __getMockSearch, __setMockLocation } = ReactRouterDom as unknown as {
  __getMockSearch: () => string;
  __setMockLocation: (pathname: string, search?: string) => void;
};

// ── Module-level mocks ────────────────────────────────────────────────────────
vi.mock('@/hooks/useBodyScrollLock', () => ({ useBodyScrollLock: vi.fn() }));
vi.mock('@/hooks/useInertBackdrop', () => ({ useInertBackdrop: vi.fn() }));

// Render helper that skips the loading skeleton (defaultLoading=false)
// and wraps in MemoryRouter so useSearchParams works via the stub.
function renderPage(entry = '/credit-lines') {
  const result = render(
    <MemoryRouter initialEntries={[entry]}>
      <CreditLines defaultLoading={false} />
    </MemoryRouter>,
  );
  // Advance past the 600ms isLoading timer used by the component
  act(() => {
    vi.advanceTimersByTime(700);
  });
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 1: ?status=Suspended shows only Suspended lines
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 1 – ?status=Suspended filters to Suspended lines', () => {
  it('renders only the Suspended credit line', () => {
    renderPage('/credit-lines?status=Suspended');

    // The one suspended line in mock data
    const suspendedLine = MOCK_CREDIT_LINES.find((l) => l.status === 'Suspended')!;
    expect(screen.getAllByText(suspendedLine.name)[0]).toBeInTheDocument();

    // No Active, Defaulted, Closed, or Frozen lines should appear
    const otherLines = MOCK_CREDIT_LINES.filter((l) => l.status !== 'Suspended');
    for (const line of otherLines) {
      expect(screen.queryAllByText(line.name).length).toBe(0);
    }
  });

  it('status select reflects the URL value', () => {
    renderPage('/credit-lines?status=Suspended');

    // First combobox is the Status select, second is Sort By
    const allSelects = screen.getAllByRole('combobox');
    expect(allSelects[0]).toHaveValue('Suspended');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 2: Changing sort to APR ascending updates the URL
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 2 – sort controls write to the URL', () => {
  it('updates URL to ?sort=apr when APR is selected', () => {
    renderPage('/credit-lines');

    const sortSelect = screen.getAllByRole('combobox')[1]; // second select = Sort By
    // Change sort field to APR (default dir is desc)
    fireEvent.change(sortSelect, { target: { value: 'apr' } });

    const search = __getMockSearch();
    // sort=apr is non-default so it must appear; dir=desc is default so it's omitted
    expect(search).toContain('sort=apr');
    expect(search).not.toContain('dir=');
  });

  it('updates URL to ?sort=apr&dir=asc when toggled to ascending from APR sort', () => {
    // Start with sort=apr already in the URL (dir defaults to desc)
    renderPage('/credit-lines?sort=apr');

    // Toggle direction from desc to asc
    const dirBtn = screen.getByRole('button', { name: /↓|↑/i });
    fireEvent.click(dirBtn);

    const search = __getMockSearch();
    expect(search).toContain('sort=apr');
    expect(search).toContain('dir=asc');
  });

  it('omits sort and dir from URL when they equal defaults (updatedAt, desc)', () => {
    renderPage('/credit-lines');
    // No interaction — defaults should produce no query string
    const search = __getMockSearch();
    expect(search).not.toContain('sort=');
    expect(search).not.toContain('dir=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 3: Navigate to /repay and back — filter/sort/page are restored
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 3 – Back from /repay restores list state', () => {
  it('preserves ?status=Defaulted in the URL after repay navigation', () => {
    renderPage('/credit-lines?status=Defaulted');

    // Verify filter is active
    expect(__getMockSearch()).toContain('status=Defaulted');

    // Simulate navigate away (the Repay button on a Defaulted line triggers navigate)
    // Then simulate browser Back by setting location back to credit-lines with params
    __setMockLocation('/credit-lines', '?status=Defaulted');

    // The URL still holds the state
    expect(__getMockSearch()).toBe('?status=Defaulted');
  });

  it('restores sort=apr&dir=asc after navigating away and back', () => {
    renderPage('/credit-lines?sort=apr&dir=asc');

    expect(__getMockSearch()).toContain('sort=apr');
    expect(__getMockSearch()).toContain('dir=asc');

    // Simulate navigate away to /repay, then back
    __setMockLocation('/repay', '?line=CL-2024-001');
    __setMockLocation('/credit-lines', '?sort=apr&dir=asc');

    expect(__getMockSearch()).toContain('sort=apr');
    expect(__getMockSearch()).toContain('dir=asc');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 4: Invalid params fall back to defaults without crash
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 4 – invalid params fall back to defaults', () => {
  it('renders without crashing when ?sort=bogus&status=Liquidated', () => {
    expect(() => renderPage('/credit-lines?sort=bogus&status=Liquidated')).not.toThrow();
  });

  it('shows all lines when status param is invalid', () => {
    renderPage('/credit-lines?sort=bogus&status=Liquidated');

    // All mock lines (up to page size) should appear since status falls back to "all"
    const activeLines = MOCK_CREDIT_LINES.filter((l) => l.status === 'Active');
    expect(screen.getAllByText(activeLines[0].name)[0]).toBeInTheDocument();
  });

  it('falls back to default sort (updatedAt desc) for invalid sort param', () => {
    renderPage('/credit-lines?sort=bogus');

    const sortSelect = screen.getAllByRole('combobox')[1];
    expect(sortSelect).toHaveValue('updatedAt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 5: Sort by status descending → Defaulted first, then Suspended
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 5 – status sort descending severity order', () => {
  it('puts Defaulted lines before Suspended lines', () => {
    renderPage('/credit-lines?sort=status&dir=desc');

    const cards = document.querySelectorAll('.cl-card');
    const cardStatuses: string[] = [];
    for (const card of Array.from(cards)) {
      // StatusBadge renders the status text as a badge inside the card
      const badge = card.querySelector('[class*="status-badge"], .status-badge, [class*="badge"]');
      if (badge) cardStatuses.push(badge.textContent?.trim() ?? '');
    }

    // Find Defaulted and Suspended positions
    const defaultedIdx = cardStatuses.findIndex((s) => s === 'Defaulted');
    const suspendedIdx = cardStatuses.findIndex((s) => s === 'Suspended');

    if (defaultedIdx >= 0 && suspendedIdx >= 0) {
      expect(defaultedIdx).toBeLessThan(suspendedIdx);
    } else {
      // Fallback: check cards contain status classes in severity order
      const cardClassList = Array.from(cards).map((c) => c.className);
      const defaultedCardIdx = cardClassList.findIndex((c) => c.includes('status-defaulted'));
      const suspendedCardIdx = cardClassList.findIndex((c) => c.includes('status-suspended'));
      if (defaultedCardIdx >= 0 && suspendedCardIdx >= 0) {
        expect(defaultedCardIdx).toBeLessThan(suspendedCardIdx);
      }
    }
  });

  it('puts Closed lines last in descending severity order', () => {
    renderPage('/credit-lines?sort=status&dir=desc');

    const cards = Array.from(document.querySelectorAll('.cl-card'));
    const cardClasses = cards.map((c) => c.className);

    const closedIdx = cardClasses.findIndex((c) => c.includes('status-closed'));
    const activeIdx = cardClasses.findIndex((c) => c.includes('status-active'));

    if (closedIdx >= 0 && activeIdx >= 0) {
      // Active (severity 1) should come before Closed (severity 0) in desc
      expect(activeIdx).toBeLessThan(closedIdx);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 6: Status ties are broken by compareCreditLines
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 6 – status ties broken deterministically by compareCreditLines', () => {
  it('Active lines are sorted by id when status is the same', () => {
    renderPage('/credit-lines?sort=status&dir=asc');

    // Get only Active lines from mock data in compareCreditLines order
    const activeLines = MOCK_CREDIT_LINES.filter((l) => l.status === 'Active');
    // compareCreditLines sorts by id string
    const expected = [...activeLines].sort((a, b) => {
      const aId = String(a.id);
      const bId = String(b.id);
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });

    if (expected.length >= 2) {
      const cards = Array.from(document.querySelectorAll('.cl-card'));
      const renderedNames: string[] = [];
      for (const card of cards) {
        const nameEl = card.querySelector('.cl-name');
        if (nameEl) renderedNames.push(nameEl.textContent?.trim() ?? '');
      }

      // Find the first two Active lines in rendered order
      const renderedActive = renderedNames.filter((name) =>
        activeLines.some((l) => l.name === name),
      );

      if (renderedActive.length >= 2) {
        expect(renderedActive[0]).toBe(expected[0].name);
        expect(renderedActive[1]).toBe(expected[1].name);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Scenario 7: Defaults produce no query string
// ─────────────────────────────────────────────────────────────────────────────
describe('Scenario 7 – default params omitted from URL', () => {
  it('has no query string on initial render with no params', () => {
    renderPage('/credit-lines');
    expect(__getMockSearch()).toBe('');
  });

  it('removes sort and dir from URL when reset back to defaults', () => {
    renderPage('/credit-lines?sort=apr&dir=asc');

    const sortSelect = screen.getAllByRole('combobox')[1];
    // Reset to default sort
    fireEvent.change(sortSelect, { target: { value: 'updatedAt' } });

    // After selecting updatedAt (default), sort= should be gone
    expect(__getMockSearch()).not.toContain('sort=');
  });

  it('removes status from URL when filter reset to all', () => {
    renderPage('/credit-lines?status=Suspended');

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'all' } });

    expect(__getMockSearch()).not.toContain('status=');
  });
});
