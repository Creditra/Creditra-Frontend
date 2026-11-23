import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Breadcrumb } from './Breadcrumb';

function renderBreadcrumb(
  items: { label: string; to?: string }[],
  maxVisible?: number,
) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} maxVisible={maxVisible} />
    </MemoryRouter>,
  );
}

describe('Breadcrumb', () => {
  it('renders nothing for empty items', () => {
    const { container } = renderBreadcrumb([]);
    expect(container.querySelector('nav')).not.toBeInTheDocument();
  });

  it('renders all items when under maxVisible', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }, { label: 'Settings' }]);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the last item with aria-current="page"', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }, { label: 'Dashboard' }]);
    const current = screen.getByText('Dashboard');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('renders links for items with `to`', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }, { label: 'Page' }]);
    const link = screen.getByRole('link', { name: 'Home' });
    expect(link).toHaveAttribute('href', '/');
  });

  it('applies middle-ellipsis when items exceed maxVisible', () => {
    const items = [
      { label: 'A' },
      { label: 'B' },
      { label: 'C' },
      { label: 'D' },
      { label: 'E' },
    ];
    renderBreadcrumb(items, 3);

    // Should show first, ellipsis, then last (maxVisible-2=1) tail items
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByText('E')).toBeInTheDocument();

    // Middle items should NOT be visible
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.queryByText('C')).not.toBeInTheDocument();
    expect(screen.queryByText('D')).not.toBeInTheDocument();
  });

  it('has correct nav aria-label', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }]);
    const nav = screen.getByRole('navigation');
    expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
  });

  it('separators are aria-hidden', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }, { label: 'Page' }]);
    // The separator "/" should be present but hidden from AT
    const seps = document.querySelectorAll('.breadcrumb__sep');
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((sep) => {
      expect(sep).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('uses accessible list structure', () => {
    renderBreadcrumb([{ label: 'Home', to: '/' }, { label: 'Page' }]);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBe(2);
  });
});
