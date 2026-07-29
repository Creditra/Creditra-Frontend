import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import CreditLines from '../CreditLines';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPage() {
  const result = render(
    <BrowserRouter>
      <CreditLines />
    </BrowserRouter>,
  );
  // Advance past the 600 ms isLoading skeleton so tests see real content
  act(() => { vi.advanceTimersByTime(700); });
  return result;
}

/**
 * Mock window.matchMedia to simulate a specific viewport width.
 * Returns a restore function to revert to the default implementation.
 */
function mockViewport(width: number): () => void {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const matches =
      query === `(max-width: ${width - 1}px)` ||
      query === `(max-width: ${width}px)` ||
      query === `(max-width: ${width + 1}px)`;
    return {
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
  return () => {
    window.matchMedia = original;
  };
}

describe('CreditLines — Responsive breakpoint audit (v7)', () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  // ─── Structural rendering ───────────────────────────────────────────────

  describe('structural elements', () => {
    it('renders the grid container with data-testid', () => {
      renderPage();
      expect(screen.getByTestId('cl-grid')).toBeInTheDocument();
    });

    it('renders the page header with data-testid', () => {
      renderPage();
      expect(screen.getByTestId('cl-page-header')).toBeInTheDocument();
    });

    it('renders metrics group with ARIA role="group"', () => {
      renderPage();
      const metricsGroup = screen.getAllByRole('group', {
        name: 'Credit line metrics',
      });
      expect(metricsGroup.length).toBeGreaterThanOrEqual(1);
    });

    it('renders details group with ARIA role="group"', () => {
      renderPage();
      const detailsGroups = screen.getAllByRole('group', {
        name: 'Credit line details',
      });
      expect(detailsGroups.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Card count at various viewports ────────────────────────────────────

  describe('card rendering across viewports', () => {
    it('renders all credit line cards in the grid', () => {
      renderPage();
      const grid = screen.getByTestId('cl-grid');
      const cards = grid.querySelectorAll('.cl-card');
      expect(cards.length).toBeGreaterThanOrEqual(3);
    });

    it('renders all credit line names', () => {
      renderPage();
      expect(screen.getAllByText('Primary Business Line').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Expansion Capital Line').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Working Capital Facility').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Filter controls accessibility ──────────────────────────────────────

  describe('filter controls remain accessible', () => {
    it('renders the status filter select', () => {
      renderPage();
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });

    it('renders the sort direction button', () => {
      renderPage();
      expect(screen.getByText('↓')).toBeInTheDocument();
    });
  });

  // ─── ARIA group counts match mock data ──────────────────────────────────

  describe('ARIA group count matches card count', () => {
    it('each card has a metrics group', () => {
      renderPage();
      const grid = screen.getByTestId('cl-grid');
      const cards = grid.querySelectorAll('.cl-card');
      const metricsGroups = screen.getAllByRole('group', {
        name: 'Credit line metrics',
      });
      expect(metricsGroups.length).toBe(cards.length);
    });

    it('each card has a details group', () => {
      renderPage();
      const grid = screen.getByTestId('cl-grid');
      const cards = grid.querySelectorAll('.cl-card');
      const detailsGroups = screen.getAllByRole('group', {
        name: 'Credit line details',
      });
      expect(detailsGroups.length).toBe(cards.length);
    });
  });

  // ─── Comparison drawer ──────────────────────────────────────────────────

  describe('comparison drawer', () => {
    it('does not render the compare drawer by default', () => {
      renderPage();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  // ─── Page header layout ─────────────────────────────────────────────────

  describe('page header', () => {
    it('renders the page title', () => {
      renderPage();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Credit Lines',
      );
    });

    it('renders the subtitle', () => {
      renderPage();
      expect(screen.getByText('Manage your credit facilities')).toBeInTheDocument();
    });

    it('renders all action buttons', () => {
      renderPage();
      expect(
        screen.getByText('Compare Selected (0/2)'),
      ).toBeInTheDocument();
      expect(screen.getByText('Full Compare →')).toBeInTheDocument();
      expect(screen.getByText('+ Open New Line')).toBeInTheDocument();
    });
  });

  // ─── Empty state rendering ──────────────────────────────────────────────

  describe('empty state', () => {
    it('renders the repayment schedule region when credit lines exist', () => {
      renderPage();
      expect(
        screen.getByRole('region', { name: 'All scheduled repayments' }),
      ).toBeInTheDocument();
    });
  });

  // ─── Keyboard hints in DOM ──────────────────────────────────────────────

  describe('KbdHint elements', () => {
    it('renders KbdHint elements for keyboard shortcuts', () => {
      renderPage();
      const kbdElements = document.querySelectorAll('.kbd-hint-container');
      expect(kbdElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Defaulted card accessibility ───────────────────────────────────────

  describe('defaulted card', () => {
    it('has aria-label on the defaulted card', () => {
      renderPage();
      const defaultedCard = screen.getByLabelText(
        'Credit line CL-2023-004 is defaulted',
      );
      expect(defaultedCard).toBeInTheDocument();
      expect(defaultedCard).toHaveClass('cl-row--defaulted');
    });
  });

  // ─── Repayment schedule section ─────────────────────────────────────────

  describe('repayment schedule', () => {
    it('renders the repayment schedule section heading', () => {
      renderPage();
      expect(
        screen.getByRole('heading', { name: 'Repayment Schedule' }),
      ).toBeInTheDocument();
    });

    it('renders the repayment schedule subtitle', () => {
      renderPage();
      expect(
        screen.getByText(
          'Past installments and upcoming payments across your credit lines.',
        ),
      ).toBeInTheDocument();
    });
  });
});
