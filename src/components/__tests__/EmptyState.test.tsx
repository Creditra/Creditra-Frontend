import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EmptyState } from '../EmptyState';

/**
 * Tests for the shared themed empty-state component.
 *
 * Covers the API contract:
 *
 * - required props (illustration, title, description) render correctly
 * - eyebrow renders when provided
 * - primaryAction renders as a <Link> when `to` is given, as a button when
 *   `onClick` is given
 * - secondaryAction renders alongside primary
 * - tone prop applies a class & does not break the layout
 * - accessibility defaults: role="status", aria-live="polite"
 * - the heading is the accessible name (aria-labelledby)
 *
 * Visual snapshot testing is intentionally NOT included; the design team
 * owns source-of-truth visuals in Figma. These tests focus on behaviour.
 */

function renderInRouter(ui: React.ReactNode, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
  );
}

describe('EmptyState', () => {
  it('renders the illustration, title, and description', () => {
    renderInRouter(
      <EmptyState
        illustration={<svg data-testid="illus" aria-hidden="true" />}
        title="No data"
        description="There is nothing here yet."
      />,
    );

    expect(screen.getByTestId('illus')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No data' }),
    ).toBeInTheDocument();
    expect(screen.getByText('There is nothing here yet.')).toBeInTheDocument();
  });

  it('renders the eyebrow text above the title when provided', () => {
    renderInRouter(
      <EmptyState
        eyebrow="All caught up"
        illustration={<span aria-hidden="true" />}
        title="Nothing to repay"
        description="Come back later."
      />,
    );

    expect(screen.getByText('All caught up')).toBeInTheDocument();
    // eyebrow comes before the heading in the DOM
    const eyebrow = screen.getByText('All caught up');
    const heading = screen.getByRole('heading', { level: 2 });
    expect(
      eyebrow.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('does not render the eyebrow node when the prop is omitted', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Headline"
        description="Body copy."
      />,
    );

    expect(screen.queryByText(/empty-state__eyebrow/i)).not.toBeInTheDocument();
  });

  it('renders primaryAction as a router Link when `to` is provided', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Empty"
        description="Body."
        primaryAction={{ label: 'Go create', to: '/open-credit' }}
      />,
    );

    const link = screen.getByRole('link', { name: 'Go create' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/open-credit');
    expect(link).toHaveClass('empty-state-btn');
  });

  it('renders primaryAction as a button when only `onClick` is provided', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Empty"
        description="Body."
        primaryAction={{ label: 'Do thing', onClick }}
      />,
    );

    const button = screen.getByRole('button', { name: 'Do thing' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('empty-state-btn');

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders both actions when primary and secondary are supplied', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Empty"
        description="Body."
        primaryAction={{ label: 'Primary', to: '/a' }}
        secondaryAction={{ label: 'Secondary', to: '/b' }}
      />,
    );

    const primary = screen.getByRole('link', { name: 'Primary' });
    const secondary = screen.getByRole('link', { name: 'Secondary' });
    expect(primary).toHaveClass('empty-state-btn');
    expect(secondary).toHaveClass('empty-state-secondary-btn');
  });

  it('omits the actions row entirely when no actions are provided', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Just info"
        description="No buttons here."
      />,
    );

    expect(
      screen.queryByRole('link', { name: /.*/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /.*/ }),
    ).not.toBeInTheDocument();
  });

  it('applies the success tone class without changing semantics', () => {
    renderInRouter(
      <EmptyState
        tone="success"
        illustration={<span aria-hidden="true" />}
        title="All done"
        description="Nothing to do."
      />,
    );

    const region = screen.getByRole('status');
    expect(region).toHaveClass('empty-state--success');
    expect(region).toHaveClass('empty-state');
  });

  it('renders the decorative accent-rule when tone is provided', () => {
    renderInRouter(
      <EmptyState
        tone="info"
        illustration={<span aria-hidden="true" />}
        title="Info state"
        description="Body."
      />,
    );

    const region = screen.getByRole('status');
    const rule = region.querySelector('.empty-state__accent-rule');
    expect(rule).toBeInTheDocument();
  });

  it('does not render the accent-rule when tone is omitted', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="No tone"
        description="Body."
      />,
    );

    const region = screen.getByRole('status');
    const rule = region.querySelector('.empty-state__accent-rule');
    expect(rule).not.toBeInTheDocument();
  });

  it('positions the accent-rule between the illustration and the eyebrow', () => {
    renderInRouter(
      <EmptyState
        tone="info"
        eyebrow="Section"
        illustration={<span data-testid="mock-illus" aria-hidden="true" />}
        title="Position"
        description="Check order."
      />,
    );

    const region = screen.getByRole('status');
    const children = Array.from(region.children);
    const ruleIdx = children.findIndex(
      (c) => c.className === 'empty-state__accent-rule',
    );
    const illusIdx = children.findIndex(
      (c) => c.querySelector('[data-testid="mock-illus"]'),
    );
    const eyebrowIdx = children.findIndex(
      (c) => c.className === 'empty-state__eyebrow',
    );

    expect(ruleIdx).toBeGreaterThan(illusIdx);
    expect(ruleIdx).toBeLessThan(eyebrowIdx);
  });

  it('uses role="status" with aria-live="polite" by default', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Empty"
        description="Body."
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('labels the heading so the region carries an accessible name', () => {
    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="Nothing here"
        description="Body."
      />,
    );

    const status = screen.getByRole('status');
    const headingId = status.getAttribute('aria-labelledby');
    expect(headingId).toBeTruthy();
    expect(document.getElementById(headingId!)).toHaveTextContent(
      'Nothing here',
    );
  });

  it('honours a custom titleId when provided', () => {
    renderInRouter(
      <EmptyState
        titleId="custom-title"
        illustration={<span aria-hidden="true" />}
        title="Headline"
        description="Body."
      />,
    );

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-labelledby')).toBe('custom-title');
    expect(document.getElementById('custom-title')).toHaveTextContent('Headline');
  });

  it('forwards data-testid for test targeting', () => {
    renderInRouter(
      <EmptyState
        data-testid="my-empty"
        illustration={<span aria-hidden="true" />}
        title="E"
        description="D"
      />,
    );

    expect(screen.getByTestId('my-empty')).toBeInTheDocument();
  });

  it('supports both actions being buttons with their own handlers', async () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const user = userEvent.setup();

    renderInRouter(
      <EmptyState
        illustration={<span aria-hidden="true" />}
        title="E"
        description="D"
        primaryAction={{ label: 'P', onClick: onPrimary }}
        secondaryAction={{ label: 'S', onClick: onSecondary }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'P' }));
    await user.click(screen.getByRole('button', { name: 'S' }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
