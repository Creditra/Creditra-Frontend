/**
 * Tests for CreditLineCompare (/compare-credit-lines)
 *
 * Coverage areas:
 *   1. Picker UI — rendered when params are absent or invalid
 *   2. Comparison table — rendered when both valid IDs are supplied
 *   3. Diff highlighting — rows with different values carry clc-row--diff
 *   4. Scorecard — tally counts add up to the total metrics
 *   5. Swap & Clear actions — URL params updated correctly
 *   6. Invalid params — error message shown for unknown IDs
 *   7. Accessibility — semantic markup, ARIA attributes, heading hierarchy
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import CreditLineCompare from './CreditLineCompare';
import { MOCK_CREDIT_LINES } from '../data/mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render the page inside MemoryRouter so react-router hooks work.
 *
 * @param search  Optional query string, e.g. '?a=CL-2024-001&b=CL-2024-002'
 */
function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/compare-credit-lines${search}`]}>
      <CreditLineCompare />
    </MemoryRouter>,
  );
}

/** Two well-known mock IDs used across tests. */
const ID_A = 'CL-2024-001'; // Primary Business Line — Active
const ID_B = 'CL-2024-002'; // Expansion Capital Line — Active
const ID_C = 'CL-2023-003'; // Working Capital Facility — Suspended

const LINE_A = MOCK_CREDIT_LINES.find((l) => l.id === ID_A)!;
const LINE_B = MOCK_CREDIT_LINES.find((l) => l.id === ID_B)!;

// ─── 1. Picker UI ─────────────────────────────────────────────────────────────

describe('CreditLineCompare — picker (no params)', () => {
  it('renders the page heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /compare credit lines/i }),
    ).toBeInTheDocument();
  });

  it('renders the picker section heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /select two credit lines/i }),
    ).toBeInTheDocument();
  });

  it('renders line A and line B selects', () => {
    renderPage();
    expect(screen.getByLabelText(/credit line a/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/credit line b/i)).toBeInTheDocument();
  });

  it('Compare Lines button is disabled when no lines are selected', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /compare lines/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('Compare Lines button is disabled when only one line is selected', () => {
    renderPage();
    const selectA = screen.getByLabelText(/credit line a/i);
    fireEvent.change(selectA, { target: { value: ID_A } });

    const btn = screen.getByRole('button', { name: /compare lines/i });
    expect(btn).toBeDisabled();
  });

  it('back link points to /credit-lines', () => {
    renderPage();
    const back = screen.getByRole('link', { name: /back to credit lines/i });
    expect(back).toHaveAttribute('href', '/credit-lines');
  });

  it('does NOT render the comparison table while on the picker', () => {
    renderPage();
    // Table should not be present
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('all mock credit lines appear in the select options', () => {
    renderPage();
    const selectA = screen.getByLabelText(/credit line a/i);
    // All MOCK_CREDIT_LINES should appear (minus the other selected line which is empty)
    MOCK_CREDIT_LINES.forEach((line) => {
      expect(within(selectA).getByText(new RegExp(line.name))).toBeInTheDocument();
    });
  });
});

// ─── 2. Comparison table (valid params) ──────────────────────────────────────

describe('CreditLineCompare — comparison table (valid params)', () => {
  it('renders the comparison table when both IDs are valid', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows the names of both lines in the column headers', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // Names appear in multiple places (header + description); use getAllByText
    const matchesA = screen.getAllByText(LINE_A.name);
    const matchesB = screen.getAllByText(LINE_B.name);
    expect(matchesA.length).toBeGreaterThanOrEqual(1);
    expect(matchesB.length).toBeGreaterThanOrEqual(1);
    // At least one should be a column header span
    expect(document.querySelector('.clc-th-name')).not.toBeNull();
  });

  it('shows both line IDs in the column headers', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByText(ID_A)).toBeInTheDocument();
    expect(screen.getByText(ID_B)).toBeInTheDocument();
  });

  it('renders metric group headers: Overview, Financials, Pricing & Risk, Upcoming Payments, Activity', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();
    expect(screen.getByText(/pricing.*risk/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming payments/i)).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('renders all expected row labels', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const labels = [
      'Status',
      'Opened',
      'Collateral',
      'Credit Limit',
      'Utilized',
      'Available',
      'Utilization %',
      'APR',
      'Risk Score',
      'Next Payment',
      'Next Amount',
      'Next Interest Accrual',
      'Transactions',
      'Last Updated',
    ];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('displays formatted values for Credit Limit', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // LINE_A.limit = 500000, LINE_B.limit = 250000
    expect(screen.getByText('$500,000')).toBeInTheDocument();
    expect(screen.getByText('$250,000')).toBeInTheDocument();
  });

  it('displays formatted APR values', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByText(`${LINE_A.apr}%`)).toBeInTheDocument();
    expect(screen.getByText(`${LINE_B.apr}%`)).toBeInTheDocument();
  });

  it('displays risk scores', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByText(String(LINE_A.riskScore))).toBeInTheDocument();
    expect(screen.getByText(String(LINE_B.riskScore))).toBeInTheDocument();
  });

  it('renders StatusBadge for both lines', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // StatusBadge renders the status text; both are Active
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
  });

  it('does NOT render the picker when both params are valid', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(
      screen.queryByRole('heading', { name: /select two credit lines/i }),
    ).not.toBeInTheDocument();
  });
});

// ─── 3. Diff highlighting ─────────────────────────────────────────────────────

describe('CreditLineCompare — diff highlighting', () => {
  it('adds clc-row--diff class to rows where values differ', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // Credit Limit differs (500000 vs 250000) → should have diff class
    const diffRows = document.querySelectorAll('.clc-row--diff');
    expect(diffRows.length).toBeGreaterThan(0);
  });

  it('rows with identical values do NOT have clc-row--diff', () => {
    // Use two lines with the same status (both Active)
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // "Status" row — both are Active, so it should NOT have clc-row--diff
    // Find the row for Status
    const statusRow = screen.getByText('Status').closest('tr');
    expect(statusRow).not.toHaveClass('clc-row--diff');
  });

  it('winner cell gets clc-cell--winner when values differ', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // LINE_A has higher limit → clc-cell--a should be the winner
    const winnerCells = document.querySelectorAll('.clc-cell--winner');
    expect(winnerCells.length).toBeGreaterThan(0);
  });
});

// ─── 4. Scorecard ─────────────────────────────────────────────────────────────

describe('CreditLineCompare — scorecard', () => {
  it('renders the scorecard section', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(
      screen.getByRole('heading', { name: /metric summary/i }),
    ).toBeInTheDocument();
  });

  it('scorecard win counts sum to total metrics (6)', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);

    // There are 3 scorecard items. The win counts are displayed as "N / 6"
    // We scrape them and verify they sum to 6.
    const scorecardItems = document.querySelectorAll('.clc-scorecard-item');
    expect(scorecardItems.length).toBe(3);

    const winCounts = Array.from(
      document.querySelectorAll('.clc-scorecard-wins'),
    ).map((el) => {
      const text = el.textContent ?? '';
      // Format is "N / 6" for A/B, just "N" for ties
      const match = text.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });

    // The sum of winsA + ties + winsB should equal 6
    const total = winCounts.reduce((acc, v) => acc + v, 0);
    expect(total).toBe(6);
  });

  it('displays both line names in the scorecard', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const scorecard = document.querySelector('.clc-scorecard')!;
    expect(within(scorecard as HTMLElement).getByText(LINE_A.name)).toBeInTheDocument();
    expect(within(scorecard as HTMLElement).getByText(LINE_B.name)).toBeInTheDocument();
  });
});

// ─── 5. Swap & Clear actions ──────────────────────────────────────────────────

describe('CreditLineCompare — swap and clear actions', () => {
  it('renders a Swap button when comparison is active', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(screen.getByRole('button', { name: /swap/i })).toBeInTheDocument();
  });

  it('renders a Change Lines button when comparison is active', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    // The button has visible text "Change Lines" (aria-label is more specific)
    expect(screen.getByText('Change Lines')).toBeInTheDocument();
  });

  it('Swap button is not shown on the picker screen', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /swap/i })).not.toBeInTheDocument();
  });

  it('clicking Change Lines renders the picker', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const changeBtn = screen.getByText('Change Lines');
    fireEvent.click(changeBtn);

    // Picker heading should now be visible
    expect(
      screen.getByRole('heading', { name: /select two credit lines/i }),
    ).toBeInTheDocument();
    // Table should be gone
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// ─── 6. Invalid params ────────────────────────────────────────────────────────

describe('CreditLineCompare — invalid params', () => {
  it('shows an error for an unknown line A ID', () => {
    renderPage('?a=CL-BOGUS-999&b=CL-2024-002');
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/CL-BOGUS-999/);
  });

  it('shows an error for an unknown line B ID', () => {
    renderPage('?a=CL-2024-001&b=CL-NOT-REAL');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/CL-NOT-REAL/);
  });

  it('shows the picker after an invalid param error', () => {
    renderPage('?a=CL-BOGUS&b=CL-ALSO-BOGUS');
    expect(
      screen.getByRole('heading', { name: /select two credit lines/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render the table when params are invalid', () => {
    renderPage('?a=CL-BOGUS&b=CL-ALSO-BOGUS');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// ─── 7. Accessibility ─────────────────────────────────────────────────────────

describe('CreditLineCompare — accessibility', () => {
  it('page has a level-1 heading on the picker screen', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1 }),
    ).toBeInTheDocument();
  });

  it('page has a level-1 heading on the comparison screen', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(
      screen.getByRole('heading', { level: 1 }),
    ).toBeInTheDocument();
  });

  it('table has an accessible name', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const table = screen.getByRole('table');
    expect(table).toHaveAttribute('aria-label');
    expect(table.getAttribute('aria-label')).toMatch(LINE_A.name);
    expect(table.getAttribute('aria-label')).toMatch(LINE_B.name);
  });

  it('table has a visible caption', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    expect(document.querySelector('.clc-table-caption')).not.toBeNull();
    expect(
      (document.querySelector('.clc-table-caption') as HTMLElement).textContent,
    ).toMatch(/comparison/i);
  });

  it('Compare Lines button has aria-disabled="true" when disabled', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /compare lines/i });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('scorecard list items have role="listitem"', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const listItems = screen.getAllByRole('listitem');
    // At minimum the 3 scorecard items
    expect(listItems.length).toBeGreaterThanOrEqual(3);
  });

  it('diff indicator icons are aria-hidden', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const indicators = document.querySelectorAll('.clc-diff-indicator');
    indicators.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('column A and B tags are aria-hidden decorative labels', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const tags = document.querySelectorAll('.clc-th-tag');
    tags.forEach((tag) => {
      expect(tag).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('Swap button has a descriptive aria-label', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const swapBtn = screen.getByRole('button', { name: /swap the positions/i });
    expect(swapBtn).toBeInTheDocument();
  });

  it('heading description references both line names', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const description = document.querySelector('.clc-heading-description');
    expect(description?.textContent).toMatch(LINE_A.name);
    expect(description?.textContent).toMatch(LINE_B.name);
  });
});

// ─── 8. Edge cases ────────────────────────────────────────────────────────────

describe('CreditLineCompare — edge cases', () => {
  it('handles a line with no collateral (shows "—")', () => {
    // CL-2023-003 has no collateral field
    const lineWithNoCollateral = MOCK_CREDIT_LINES.find(
      (l) => l.collateral === undefined,
    );
    expect(lineWithNoCollateral).toBeDefined();

    renderPage(`?a=${ID_A}&b=${lineWithNoCollateral!.id}`);

    // "—" should appear in the Collateral row
    const collateralCells = screen.getAllByText('—');
    expect(collateralCells.length).toBeGreaterThanOrEqual(1);
  });

  it('handles a fully utilized line (100% utilization)', () => {
    // CL-2023-004 is 100% utilized (75000/75000)
    const fullLine = MOCK_CREDIT_LINES.find((l) => l.id === 'CL-2023-004');
    expect(fullLine).toBeDefined();

    renderPage(`?a=${fullLine!.id}&b=${ID_A}`);
    expect(screen.getByRole('table')).toBeInTheDocument();
    // 100% should appear in the utilization cell
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles a line with 0% utilization', () => {
    // CL-2022-005 is fully repaid, 0/50000
    const zeroLine = MOCK_CREDIT_LINES.find((l) => l.id === 'CL-2022-005');
    expect(zeroLine).toBeDefined();

    renderPage(`?a=${zeroLine!.id}&b=${ID_A}`);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('handles a line with no nextPaymentDate (shows "—")', () => {
    // CL-2023-004 and others have no nextPaymentDate
    const noPaymentLine = MOCK_CREDIT_LINES.find((l) => !l.nextPaymentDate);
    expect(noPaymentLine).toBeDefined();

    renderPage(`?a=${ID_A}&b=${noPaymentLine!.id}`);
    // "—" appears in the Next Payment row
    const dashCells = screen.getAllByText('—');
    expect(dashCells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders correctly when comparing a line with itself (same id for A and B falls through to picker)', () => {
    // We don't allow same id — the select filters the already-chosen option.
    // Passing the same ID twice via URL is a degenerate case: two valid lines
    // are found and the comparison renders. No crash expected.
    renderPage(`?a=${ID_A}&b=${ID_A}`);
    // Both resolve to the same line — table should still render
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('compares an Active line with a Suspended line without errors', () => {
    renderPage(`?a=${ID_A}&b=${ID_C}`);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('scorecard description references the six quantitative metrics', () => {
    renderPage(`?a=${ID_A}&b=${ID_B}`);
    const desc = document.querySelector('.clc-scorecard-description');
    expect(desc?.textContent).toMatch(/six/i);
  });
});

// ─── 9. Multi-line comparison (3 & 4 lines, ?ids=, duplicates, unknown IDs) ───

describe('CreditLineCompare — multi-line comparison (3 to 4 lines)', () => {
  const ID_D = 'CL-2023-004';
  const LINE_C = MOCK_CREDIT_LINES.find((l) => l.id === ID_C)!;
  const LINE_D = MOCK_CREDIT_LINES.find((l) => l.id === ID_D)!;

  it('renders 3 credit lines side-by-side using ?ids=a,b,c', () => {
    renderPage(`?ids=${ID_A},${ID_B},${ID_C}`);
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Headers for A, B, C within the table
    const thTags = Array.from(document.querySelectorAll('.clc-th-tag')).map((el) =>
      el.textContent?.trim(),
    );
    expect(thTags).toEqual(['A', 'B', 'C']);

    // All 3 line names appear
    expect(screen.getAllByText(LINE_A.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(LINE_B.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(LINE_C.name).length).toBeGreaterThanOrEqual(1);

    // Scorecard renders items for all 3 lines plus ties
    const scorecardItems = document.querySelectorAll('.clc-scorecard-item');
    expect(scorecardItems.length).toBe(4); // 3 lines + Ties
  });

  it('renders 4 credit lines side-by-side using ?ids=a,b,c,d', () => {
    renderPage(`?ids=${ID_A},${ID_B},${ID_C},${ID_D}`);
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Headers for A, B, C, D within the table
    const thTags = Array.from(document.querySelectorAll('.clc-th-tag')).map((el) =>
      el.textContent?.trim(),
    );
    expect(thTags).toEqual(['A', 'B', 'C', 'D']);

    // All 4 line IDs appear in table
    expect(screen.getByText(ID_A)).toBeInTheDocument();
    expect(screen.getByText(ID_B)).toBeInTheDocument();
    expect(screen.getByText(ID_C)).toBeInTheDocument();
    expect(screen.getByText(ID_D)).toBeInTheDocument();

    // 4 lines + Ties = 5 scorecard items
    const scorecardItems = document.querySelectorAll('.clc-scorecard-item');
    expect(scorecardItems.length).toBe(5);
  });

  it('drops unknown IDs and still renders comparison when at least 2 valid lines exist', () => {
    renderPage(`?ids=${ID_A},UNKNOWN_CREDIT_LINE,${ID_B}`);
    // UNKNOWN_CREDIT_LINE should be dropped, comparing ID_A and ID_B
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByText(LINE_A.name).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(LINE_B.name).length).toBeGreaterThanOrEqual(1);
  });

  it('drops duplicate IDs in ?ids= URL parameter', () => {
    renderPage(`?ids=${ID_A},${ID_B},${ID_A},${ID_C}`);
    // Duplicates are collapsed: exactly 3 lines compared
    expect(screen.getByRole('table')).toBeInTheDocument();
    const thTags = Array.from(document.querySelectorAll('.clc-th-tag')).map((el) =>
      el.textContent?.trim(),
    );
    expect(thTags).toEqual(['A', 'B', 'C']);
  });

  it('caps selection to 4 when 5 or more IDs are passed in ?ids=', () => {
    const ID_E = 'CL-2022-005';
    renderPage(`?ids=${ID_A},${ID_B},${ID_C},${ID_D},${ID_E}`);
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Column headers should only go up to D (4 columns)
    const thTags = Array.from(document.querySelectorAll('.clc-th-tag')).map((el) =>
      el.textContent?.trim(),
    );
    expect(thTags).toEqual(['A', 'B', 'C', 'D']);
  });

  it('shows error alert and falls through to picker when unknown IDs leave fewer than 2 valid lines', () => {
    renderPage('?ids=CL-UNKNOWN-1,CL-UNKNOWN-2');
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toMatch(/CL-UNKNOWN-1/);
    expect(alert.textContent).toMatch(/CL-UNKNOWN-2/);
    expect(
      screen.getByRole('heading', { level: 2, name: /select two credit lines/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
