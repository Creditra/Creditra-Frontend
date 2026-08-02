import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, afterEach } from 'vitest';
import CreditLines from '../CreditLines';

function renderPage() {
  return render(
    <BrowserRouter>
      <CreditLines />
    </BrowserRouter>,
  );
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

  // ─── Responsive campaign image (GrantFox FWC26 / #848) ──────────────────

  describe('responsive campaign image (GrantFox FWC26 / #848)', () => {
    it('renders the campaign hero image with accessible alt text', async () => {
      renderPage();
      const image = await waitFor(() => screen.getByAltText(/Credit Lines campaign banner/i));
      expect(image).toBeInTheDocument();
    });

    it('includes responsive srcset attribute with multiple width candidates', async () => {
      renderPage();
      const image = await waitFor(() => screen.getByAltText(/Credit Lines campaign banner/i)) as HTMLImageElement;
      const srcset = image.getAttribute('srcset');
      expect(srcset).toBeTruthy();
      expect(srcset).toContain('480w');
      expect(srcset).toContain('768w');
      expect(srcset).toContain('1200w');
    });

    it('configures sizes attribute for responsive layout breakpoints', async () => {
      renderPage();
      const image = await waitFor(() => screen.getByAltText(/Credit Lines campaign banner/i)) as HTMLImageElement;
      const sizes = image.getAttribute('sizes');
      expect(sizes).toBeTruthy();
      expect(sizes).toContain('100vw');
      expect(sizes).toContain('60vw');
    });

    it('provides a default fallback src attribute', async () => {
      renderPage();
      const image = await waitFor(() => screen.getByAltText(/Credit Lines campaign banner/i)) as HTMLImageElement;
      expect(image.getAttribute('src')).toContain('/assets/images/stellar-wave-md.jpg');
    });
  });
});
