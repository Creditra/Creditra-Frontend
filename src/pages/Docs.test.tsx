import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Docs, { SECTIONS } from './Docs';
import { ROUTE_MANIFEST } from '../routes/manifest';

function renderDocs() {
  return render(
    <MemoryRouter initialEntries={['/docs']}>
      <Docs />
    </MemoryRouter>,
  );
}

/** Strip any query string or hash from an href, leaving only the path. */
function pathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

describe('Docs page', () => {
  it('renders the page heading', () => {
    renderDocs();
    expect(screen.getByRole('heading', { level: 1, name: 'Documentation' })).toBeInTheDocument();
  });

  it('renders one h2 per section with its title', () => {
    renderDocs();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(SECTIONS.length);
    expect(headings.map((h) => h.textContent)).toEqual(SECTIONS.map((s) => s.title));
  });

  it('renders every section body', () => {
    const { container } = renderDocs();
    expect(container.querySelectorAll('section')).toHaveLength(SECTIONS.length);
    for (const section of SECTIONS) {
      expect(screen.getByText(section.body)).toBeInTheDocument();
    }
  });

  it('renders a CTA link for exactly the sections that define `to`', () => {
    const { container } = renderDocs();
    const withTo = SECTIONS.filter((s) => s.to);
    expect(withTo.length).toBeGreaterThan(0);
    // The only other anchor on the page is the external "Full docs on GitHub" link,
    // which lives outside any <section>.
    expect(container.querySelectorAll('section a')).toHaveLength(withTo.length);
  });

  it('points every rendered CTA at a route registered in ROUTE_MANIFEST', () => {
    const { container } = renderDocs();
    const registered = ROUTE_MANIFEST.map((r) => r.path);
    const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('section a'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const path = pathOf(link.getAttribute('href') ?? '');
      expect(registered, `CTA "${link.textContent}" targets unregistered route ${path}`).toContain(path);
    }
  });

  it('points every SECTIONS `to` at a registered route', () => {
    const registered = ROUTE_MANIFEST.map((r) => r.path);
    for (const section of SECTIONS.filter((s) => s.to)) {
      expect(
        registered,
        `section "${section.title}" targets unregistered route ${section.to}`,
      ).toContain(pathOf(section.to as string));
    }
  });

  it('gives every section with a `to` a non-empty `cta`', () => {
    for (const section of SECTIONS.filter((s) => s.to)) {
      expect(section.cta?.trim(), `section "${section.title}" is missing a cta`).toBeTruthy();
    }
  });

  it('shows each CTA label as link text', () => {
    renderDocs();
    for (const section of SECTIONS.filter((s) => s.to)) {
      expect(screen.getByRole('link', { name: new RegExp(section.cta as string) })).toHaveAttribute(
        'href',
        section.to,
      );
    }
  });

  it('uses unique section ids and titles', () => {
    const ids = SECTIONS.map((s) => s.id).filter((id): id is string => Boolean(id));
    expect(new Set(ids).size).toBe(ids.length);
    const titles = SECTIONS.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('renders the section id on the matching element', () => {
    const { container } = renderDocs();
    for (const section of SECTIONS.filter((s) => s.id)) {
      const el = container.querySelector(`section#${section.id}`);
      expect(el).not.toBeNull();
      expect(el?.querySelector('h2')?.textContent).toBe(section.title);
    }
  });
});
