import React, { useCallback, useState } from 'react';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import CreditLines, { CreditLineCard } from '../CreditLines';
import { MOCK_CREDIT_LINES } from '../../data/mockData';
import { freezeTime, unfreezeTime } from '../../test/freezeTime';
import { renderWithCredit } from '../../test/renderWithCredit';

const amountRenderSpy = vi.hoisted(() => vi.fn());
vi.mock('../../components/Amount', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../components/Amount')>();
  return {
    ...actual,
    Amount: (props: React.ComponentProps<typeof actual.Amount>) => {
      amountRenderSpy(props.value);
      return actual.Amount(props);
    },
  };
});

beforeEach(() => {
  freezeTime();
});

afterEach(() => {
  unfreezeTime();
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
  it('submits a limit increase request and restores its pending chip after remount', async () => {
    localStorage.clear();
    const line = mockCreditLines.find((item) => item.name === 'Primary Business Line')!;
    const page = renderWithCredit(<CreditLines defaultLoading={false} />, {
      lines: [line],
      route: '/credit-lines',
    });

    fireEvent.click(await screen.findByLabelText('Menu for Primary Business Line'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'Request limit increase' }),
    );
    await screen.findByRole('dialog', { name: 'Request a limit increase' });
    fireEvent.change(screen.getByLabelText('Requested amount'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('Reason'), {
      target: { value: 'Working capital' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }));

    expect(await screen.findByText('Request submitted')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Increase pending')).toBeInTheDocument();

    page.unmount();
    renderWithCredit(<CreditLines defaultLoading={false} />, {
      lines: [line],
      route: '/credit-lines',
    });
    expect(await screen.findByText('Increase pending')).toBeInTheDocument();
  });

  it('renders the page header', () => {
    renderPage();
    expect(screen.getByText('Credit Lines')).toBeInTheDocument();
    expect(screen.getByText('Manage your credit facilities')).toBeInTheDocument();
  }, 15000);

  it('renders credit line cards from mock data', () => {
    renderPage();
    // Use getAllByText: the line name is rendered in the card title AND in
    // the row menu (aria-label), so getByText would throw "found multiple".
    expect(
      screen.getAllByText('Primary Business Line')[0],
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Expansion Capital Line')[0],
    ).toBeInTheDocument();
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

    beforeEach(() => {
      const target = MOCK_CREDIT_LINES.find((l) => l.name === 'Primary Business Line')!;
      target.limit = 75_000;
      target.utilized = 87_750;
    });

    afterEach(() => {
      const target = MOCK_CREDIT_LINES.find((l) => l.name === 'Primary Business Line')!;
      target.limit = 500_000;
      target.utilized = 187_500;
    });

    it('clamps available to $0 and shows an over-limit badge', () => {
      renderPage();
      const card = getCard('Primary Business Line');

      // Available is clamped at $0, not negative.
      const available = card.querySelector('.cl-available');
      expect(available).toBeInTheDocument();
      expect(available?.textContent).toMatch(/\$0/);
      expect(available?.textContent).not.toMatch(/-/);

      // Over-limit badge is present and includes the overage amount.
      const badge = card.querySelector('.cl-over-limit');
      expect(badge).toBeInTheDocument();
      expect(badge?.textContent).toMatch(/12,750/i);
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
      expect(atLimit!.querySelector('.cl-over-limit')).not.toBeInTheDocument();
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
      expect(screen.getAllByText("Primary Business Line")[0]).toBeInTheDocument();
    });
  });

  describe("CreditLineDetailDrawer integration", () => {
    it("opens drawer from row menu Details action, traps focus, and restores focus on Escape", async () => {
      render(
        <MemoryRouter initialEntries={["/credit-lines"]}>
          <CreditLines defaultLoading={false} />
        </MemoryRouter>
      );
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const menuTrigger = screen.getByLabelText("Menu for Primary Business Line");
      fireEvent.click(menuTrigger);

      const detailsItem = screen.getByRole("menuitem", { name: /Details/i });
      fireEvent.click(detailsItem);

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent("Primary Business Line");

      // Advance past useFocusTrap's 50ms initial focus delay
      act(() => {
        vi.advanceTimersByTime(60);
      });
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Press Escape to close and restore focus to the row menu trigger
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(document.activeElement).toBe(menuTrigger);
    });

    it("opens drawer on load when ?line=<id> deep link is present and ignores unknown ids", async () => {
      const { unmount } = render(
        <MemoryRouter initialEntries={["/credit-lines?line=CL-2024-001"]}>
          <CreditLines defaultLoading={false} />
        </MemoryRouter>
      );
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const dialog = await screen.findByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveTextContent("CL-2024-001");
      unmount();

      render(
        <MemoryRouter initialEntries={["/credit-lines?line=UNKNOWN-ID"]}>
          <CreditLines defaultLoading={false} />
        </MemoryRouter>
      );
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("APR history chart in expanded card", () => {
    it("does not render the APR history chart when a card is collapsed", () => {
      renderPage();
      expect(
        screen.queryByRole("group", { name: "APR history time window" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("apr-history-chart")).not.toBeInTheDocument();
    });

    it("renders the APR history chart group when a card with history is expanded", async () => {
      renderPage();
      const card = screen
        .getAllByText("Primary Business Line")[0]
        .closest(".cl-card") as HTMLElement;
      expect(card).toBeInTheDocument();

      const toggleBtn = card.querySelector(
        ".cl-expand-btn",
      ) as HTMLButtonElement;
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(toggleBtn);
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

      const chartGroup = await screen.findByRole("group", {
        name: "APR history time window",
      });
      expect(chartGroup).toBeInTheDocument();
      expect(card.contains(chartGroup)).toBe(true);
    });

    it("renders nothing when an expanded card has no APR history", () => {
      const target = MOCK_CREDIT_LINES.find(
        (line) => line.name === "Primary Business Line",
      )!;
      const originalHistory = target.aprHistory;
      target.aprHistory = undefined;

      try {
        renderPage();
        const card = screen
          .getAllByText("Primary Business Line")[0]
          .closest(".cl-card") as HTMLElement;
        const toggleBtn = card.querySelector(
          ".cl-expand-btn",
        ) as HTMLButtonElement;

        fireEvent.click(toggleBtn);
        expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
        expect(
          card.querySelector('[data-testid="apr-history-chart"]'),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("group", { name: "APR history time window" }),
        ).not.toBeInTheDocument();
      } finally {
        target.aprHistory = originalHistory;
      }
    });
  });

  describe("comparison selection limit", () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it("blocks selecting a third credit line once two are selected", () => {
      renderPage();

      const checkboxes = screen.getAllByRole("checkbox", {
        name: /Select .* for comparison/i,
      }) as HTMLInputElement[];
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);

      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(true);
      expect(screen.getByText("Compare Selected (2/2)")).toBeInTheDocument();

      // Attempting to select a third line is blocked
      fireEvent.click(checkboxes[2]);
      expect(checkboxes[2].checked).toBe(false);
      expect(screen.getByText("Compare Selected (2/2)")).toBeInTheDocument();
    });
  });

  describe("CreditLineCard memoisation", () => {
    it("toggling one card re-renders only that card, identical polling data causes zero re-renders, and changed data re-renders only the changed card", () => {
      amountRenderSpy.mockClear();

      const initialLines = MOCK_CREDIT_LINES.slice(0, 2).map((l, idx) => ({
        ...l,
        limit: idx === 0 ? 500_001 : 250_002,
        statusHistory: l.statusHistory.map((h) => ({ ...h })),
        aprHistory: l.aprHistory?.map((h) => ({ ...h })),
        healthHistory: l.healthHistory?.map((h) => ({ ...h })),
      }));

      const countRendersForLimit = (limit: number) =>
        amountRenderSpy.mock.calls.filter(([val]) => val === limit).length;

      function Harness() {
        const [lines, setLines] = useState(initialLines);
        const [selected, setSelected] = useState<string[]>([]);
        const [unrelatedFilter, setUnrelatedFilter] = useState("all");

        const handleToggle = useCallback((lineId: string) => {
          setSelected((prev) =>
            prev.includes(lineId)
              ? prev.filter((id) => id !== lineId)
              : [...prev, lineId],
          );
        }, []);

        const handlePollIdentical = () => {
          setLines((prev) =>
            prev.map((l) => ({
              ...l,
              statusHistory: l.statusHistory.map((h) => ({ ...h })),
              aprHistory: l.aprHistory?.map((h) => ({ ...h })),
              healthHistory: l.healthHistory?.map((h) => ({ ...h })),
            })),
          );
        };

        const handlePollChangedFirst = () => {
          setLines((prev) =>
            prev.map((l, idx) =>
              idx === 0
                ? { ...l, utilized: l.utilized + 1000, updatedAt: "2026-01-01T00:00:00Z" }
                : { ...l },
            ),
          );
        };

        return (
          <MemoryRouter>
            <button type="button" onClick={() => setUnrelatedFilter((f) => (f === "all" ? "other" : "all"))}>
              Change Filter ({unrelatedFilter})
            </button>
            <button type="button" onClick={handlePollIdentical}>
              Poll Identical
            </button>
            <button type="button" onClick={handlePollChangedFirst}>
              Poll Changed First
            </button>
            {lines.map((line) => (
              <CreditLineCard
                key={line.id}
                line={line}
                isSelected={selected.includes(line.id)}
                onToggle={handleToggle}
              />
            ))}
          </MemoryRouter>
        );
      }

      render(<Harness />);

      const firstLimit = initialLines[0].limit;
      const secondLimit = initialLines[1].limit;
      const initialFirst = countRendersForLimit(firstLimit);
      const initialSecond = countRendersForLimit(secondLimit);
      expect(initialFirst).toBeGreaterThan(0);
      expect(initialSecond).toBeGreaterThan(0);

      // Changing an unrelated filter causes zero card re-renders
      fireEvent.click(screen.getByRole("button", { name: /Change Filter/i }));
      expect(countRendersForLimit(firstLimit)).toBe(initialFirst);
      expect(countRendersForLimit(secondLimit)).toBe(initialSecond);

      // Identical polling data (fresh object references) causes zero card re-renders
      fireEvent.click(screen.getByRole("button", { name: /Poll Identical/i }));
      expect(countRendersForLimit(firstLimit)).toBe(initialFirst);
      expect(countRendersForLimit(secondLimit)).toBe(initialSecond);

      // Toggling one card re-renders only that card
      const checkboxes = screen.getAllByRole("checkbox", {
        name: /Select .* for comparison/i,
      });
      fireEvent.click(checkboxes[0]);
      const afterToggleFirst = countRendersForLimit(firstLimit);
      expect(afterToggleFirst).toBeGreaterThan(initialFirst);
      expect(countRendersForLimit(secondLimit)).toBe(initialSecond);

      // Changing a displayed field on the first card re-renders only the first card
      fireEvent.click(screen.getByRole("button", { name: /Poll Changed First/i }));
      expect(countRendersForLimit(firstLimit)).toBeGreaterThan(afterToggleFirst);
      expect(countRendersForLimit(secondLimit)).toBe(initialSecond);
    });
  });
});
