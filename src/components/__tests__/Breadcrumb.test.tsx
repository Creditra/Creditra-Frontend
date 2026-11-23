import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb, middleEllipsis } from '../Breadcrumb';
import type { BreadcrumbItem } from '../Breadcrumb';

// ─── middleEllipsis ──────────────────────────────────────────────────────────

describe('middleEllipsis', () => {
  it('returns the original string when shorter than maxLen', () => {
    expect(middleEllipsis('Hello', 10)).toBe('Hello');
  });

  it('returns the original string when equal to maxLen', () => {
    expect(middleEllipsis('1234567890', 10)).toBe('1234567890');
  });

  it('truncates with ellipsis when longer than maxLen', () => {
    const result = middleEllipsis('12345678901234567890123456', 12);
    expect(result).toContain('\u2026');
    expect(result.length).toBeLessThan(26);
  });

  it('preserves head and tail characters', () => {
    const result = middleEllipsis('ABCDEFGHIJKLMNOP', 8);
    const parts = result.split('\u2026');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe('ABCD');
    expect(parts[1]).toBe('NOP');
  });
});

// ─── Breadcrumb component ────────────────────────────────────────────────────

function renderBreadcrumb(
  items: BreadcrumbItem[],
  props?: { ellipsisThreshold?: number; className?: string },
) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} {...props} />
    </MemoryRouter>,
  );
}

describe('Breadcrumb', () => {
  it('renders nothing when items is empty', () => {
    const { container } = renderBreadcrumb([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders a single item without separators', () => {
    renderBreadcrumb([{ label: 'Home' }]);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).toBeInTheDocument();
  });

  it('renders multiple items with separators', () => {
    renderBreadcrumb([
      { label: 'Dashboard', href: '/' },
      { label: 'Credit Lines', href: '/credit-lines' },
      { label: 'Current Page' },
    ]);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);

    // Separators are rendered
    const separators = screen.getAllByText('/');
    expect(separators).toHaveLength(2);
  });

  it('has accessible nav landmark', () => {
    renderBreadcrumb([{ label: 'Home' }]);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  });

  it('marks the last item with aria-current="page"', () => {
    renderBreadcrumb([
      { label: 'Dashboard', href: '/' },
      { label: 'Current' },
    ]);

    expect(screen.getByText('Current')).toHaveAttribute('aria-current', 'page');
  });

  it('renders links for items with href', () => {
    renderBreadcrumb([
      { label: 'Dashboard', href: '/' },
      { label: 'Current' },
    ]);

    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('does not render a link for items without href', () => {
    renderBreadcrumb([{ label: 'Current Page' }]);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('applies ellipsis truncation when label exceeds threshold', () => {
    const longLabel = 'A Very Long Credit Line Name That Should Be Truncated';
    renderBreadcrumb([{ label: longLabel }], { ellipsisThreshold: 12 });

    // The innermost span contains the truncated text
    const spans = screen.getAllByText((_, element) => {
      return (
        element?.textContent?.includes('\u2026') === true &&
        element.tagName === 'SPAN' &&
        element.childElementCount === 0
      );
    });
    expect(spans.length).toBeGreaterThanOrEqual(1);
    expect(spans[0].textContent).toContain('\u2026');
    expect(spans[0].textContent!.length).toBeLessThan(longLabel.length);

    // Title attribute provides full text for accessibility
    expect(spans[0]).toHaveAttribute('title', longLabel);
  });

  it('does not truncate labels below threshold', () => {
    renderBreadcrumb([{ label: 'Short' }], { ellipsisThreshold: 24 });

    const text = screen.getByText('Short');
    expect(text).not.toHaveAttribute('title');
    expect(text.textContent).toBe('Short');
  });

  it('applies custom className', () => {
    const { container } = renderBreadcrumb([{ label: 'Home' }], {
      className: 'custom-breadcrumb',
    });

    expect(container.querySelector('.breadcrumb.custom-breadcrumb')).toBeInTheDocument();
  });

  it('applies title attribute on truncated link items', () => {
    const longLabel = 'Repayment Calendar — Primary Business Line That Is Quite Long';
    renderBreadcrumb([
      { label: longLabel, href: '/repay/calendar' },
      { label: 'Current' },
    ], { ellipsisThreshold: 15 });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('title', longLabel);
  });
});
