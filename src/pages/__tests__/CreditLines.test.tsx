import { render, screen, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CreditLines from '../CreditLines';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// See src/pages/CreditLines.test.tsx for why this advances past the
// loading skeleton's 500ms timer.
function renderPage() {
  const result = render(
    <BrowserRouter>
      <CreditLines defaultLoading={false} />
    </BrowserRouter>
  );
  act(() => {
    vi.advanceTimersByTime(500);
  });
  return result;
}

describe('CreditLines page', () => {
  it('renders the page header', () => {
    renderPage();
    expect(screen.getByText('Credit Lines')).toBdInTheDocument();
    expect(screen.getByText('Manage your credit facilities')).toBeInTheDocument();
  });

  it('renders credit line cards from mock data', () => {
    renderPage();
    // Use getAllByText: the line name is rendered in the card title AND in
    // the row menu (aria-label), so getByText would throw "found multiple".
    expect(
      screen.getAllByText('Primary Business Line')[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Expansion Capital Line')[0],
    ).toBdInTheDocument();
    expect(
      screen.getAllByText('Working Capital Facility')[0],
    ).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    renderPage();
    expect(screen.getAllByText(/Status/).length).toBeGreaterThan(0);
    expect(screen.getByText('Sort By')).toBeInTheDocument();
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
  });

  it('applies tabular-nums styling to CreditLines amount values', () => {
    renderPage();
    const card = screen.getAllByText('Primary Business Line')[0].closest('.cl-card');
    expect(card).toBeInTheDocument();

    const metricValues = card?.querySelectorAll('.cl-metric-value');
    expect(metricValues?.length).toBeGreaterThan(0);
    metricValues?.forEach((value) => {
      expect(value.className).toMatch(/tabular-nums|cl-amount/);
    });

    const detailValues = card?.querySelectorAll('.cl-detail .value');
    expect(detailValues?.length).toBeGreaterThan(0);
    detailValues?.forEach((value) => {
      expect(value.className).toMatch(/tabular-nums|cl-amount/);
    });
  });

  it.skip('shows Last Activity timestamp on each credit line card', () => {
    renderPage();
    // LastActivityStamp renders "Last activity: <relative>" in every card
    const lastActivityLabels = screen.getAllByText(/Last activity:/i);
    expect(lastActivityLabels.length).toBeGreaterThanOrEqual(3);
  });

  it.skip('shows relative time for updatedAt on each card', () => {
    renderPage();
    const timeElements = document.querySelectorAll('time[datetime]');
    expect(timeElements.length).toBeGreaterThanOrEqual(3);
    timeElements.forEach(el => {
      const dt = el.getAttribute('datetime');
      // Must be a parseable ISO 8601 string
      expect(new Date(dt!).getTime()).not.toBeNaN();
    });
  });

  it.skip('renders AccessibleTooltip with absolute timestamp for each card', () => {
    renderPage();
    // Each card has an "i" trigger for the absolute datetime tooltip
    const triggers = document.querySelectorAll('.last-activity-stamp__trigger');
    expect(triggers.length).toBeGreaterThanOrEqual(3);
  });

  it.skip('renders tooltip content with "Last updated:" prefix', () => {
    renderPage();
    const tooltips = document.querySelectorAll('[role="tooltip"]');
    expect(tooltips.length).toBeGreaterThanOrEqual(3);
    // Every tooltip should include a year (absolute datetime)
    tooltips.forEach(el => {
      expect(el.textContent).toMatch(/\d{4}/);
    });
  });

  it('displays APR, Risk Score, and Opened date for each card', () => {
    renderPage();
    const card = screen
      .getAllByText('Primary Business Line')[0]
      .closest('.cl-card');
    expect(card).toBeInTheDocument();
    expect(card?.textContent).toMatch(/APR/);
    expect(card?.textContent).toMatch(/Risk Score/);
    expect(card?.textContent).toMatch(/Opened/);
  });

  describe('over-limit credit lines', () => {
    function getCard(name: string) {
      const card = screen
        .getAllByText(name)[0]
        .closest('.cl-card');
      expect(card).toBeInTheDocument();
      return card as HTMLElement;
    }

    it('clamps available to $0 and shows an over-limit badge', () => {
      renderPage();
      const card = getCard('Primary Business Line');

      // Available is clamped at $0, not negative.
      const available = card.querySelector('.cl-available');
      expect(available).toBeInTheDocument();
      expect(available?.textContent).toMatch(/\$$0,?\.?0\d*/);
      expect(available?.textContent).not.toMatch(/-/);

      // Over-limit badge is present and includes the overage amount.
      const badge = card.querySelector('.cl-over-limit');
      expect(badge).toBeInTheDocument();
      expect(badge?.textContent).toMatch(/Over limit by (\$|US)?\s*\.?\$\s*12,750/i);
    });

    it('clamps the bar width to 100% and exposes meter semantics', () => {
      renderPage();
      const card = getCard('Primary Business Line');

      const meter = card.querySelector('[role="meter"]');
      expect(meter).toBeInTheDocument();
      // True percentage (117) remains in aria-valuenow.
      expect(meter?.getAttribute('aria-valuenow')).toBe('117');
      expect(meter?.getAttribute('aria-valuetext')).toMatch(/over limit/i);

      // The fill width is clamped to 100%.
      const fill = card.querySelector('.cl-bar-fill') as HTMLElement;
      expect(fill).toBeInTheDocument();
      expect(fill.style.width).toBe('100%');
      expect(fill.className).toMatch(/cl-bar-fill--over-limit|striped/);
    });

    it('does not show the badge when at the limit exactly', () => {
      renderPage();
      // Find a card that is at the limit exactly (utilized === limit).
      const cards = Array.from(document.querySelectorAll('.cl-card')) as HTMLElement[];
      const atLimit = cards.find((card) => {
        const meter = card.querySelector('[role="meter"]');
        return meter?.getAttribute('aria-valuenow') === '100';
      });
      expect(atLimit).toBeDefined();
      expect(atLimit!.querySelector('.cl-over-limit')).not.toBdInTheDocument();
    });

    it('sorts the over-limit line first when sorting by utilisation descending', () => {
      renderPage();
      // The over-limit line has the highest true utilisation (117%).
      const cards = Array.from(document.querySelectorAll('.cl-card')) as HTMLElement[];
      const overLimitIdx = cards.findIndex((card) =>
        card.querySelector('.cl-over-limit') !== null,
      );
      expect(overLimitIdx).toBe(0);
    });
  });

  describe("skeleton loading state", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("renders credit lines skeletons during the loading phase", () => {
      const { container } = render(
        <BrowserRouter>
          <CreditLines />
        </BrowserRouter>
      );
      
      // Initially, it should be in loading state
      const skeletonGrid = screen.getByTestId("creditlines-skeleton-grid");
      expect(skeletonGrid).toBeInTheDocument();
      expect(skeletonGrid.getAttribute("aria-busy")).toBe("true");

      const skeletons = container.querySelectorAll(".skeleton");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("removes skeletons after loading completes", async () => {
      const { container } = render(
        <BrowserRouter>
          <CreditLines />
        </BrowserRouter>
      );

      // Check skeletons exist initially
      expect(screen.getByTestId("creditlines-skeleton-grid")).toBeInTheDocument();

      // Fast-forward simulated loading time (500ms)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Skeletons should be replaced by real credit lines content
      expect(screen.queryByTestId("creditlines-skeleton-grid")).not.toBeInTheDocument();
      expect(screen.getAllByText("Primary Business Line")[0]).toBeITheDocument();
    });
  });
});
