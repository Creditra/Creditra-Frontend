import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { SmartPayCTA } from './SmartPayCTA';
import { Link } from 'react-router-dom';

describe('SmartPayCTA', () => {
  it('renders title, description, and CTA', () => {
    render(
      <MemoryRouter>
        <SmartPayCTA
          title="Try Smart Pay"
          description="Auto-repay on your terms."
          cta={<Link to="/autopay">Set up</Link>}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Try Smart Pay' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Auto-repay on your terms.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Set up' }),
    ).toBeInTheDocument();
  });

  it('renders responsive picture when images are provided', () => {
    render(
      <SmartPayCTA
        title="CTA"
        description="Desc."
        cta={<button>Go</button>}
        images={[
          { src: '/mobile.png', width: 480 },
          { src: '/desktop.png', width: 1024 },
        ]}
        imageAlt="Illustration"
      />,
    );
    const img = screen.getByAltText('Illustration');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/desktop.png');

    const sources = document.querySelectorAll('source');
    expect(sources.length).toBe(2);
  });

  it('omits image section when no images are provided', () => {
    render(
      <SmartPayCTA
        title="No Image"
        description="No picture here."
        cta={<button>Ok</button>}
      />,
    );
    expect(document.querySelector('picture')).not.toBeInTheDocument();
  });

  it('omits the shortcut hint chip when shortcutKeys is not provided', () => {
    render(
      <SmartPayCTA
        title="No Shortcut"
        description="No hint here."
        cta={<button>Ok</button>}
      />,
    );
    expect(document.querySelector('.smartpay-cta__shortcut-hint')).not.toBeInTheDocument();
  });

  it('renders a shortcut hint chip next to the CTA when shortcutKeys is provided', () => {
    render(
      <SmartPayCTA
        title="Pay Now"
        description="Repay instantly."
        cta={<button>Pay</button>}
        shortcutKeys={['Ctrl', 'Enter']}
        shortcutLabel="Pay now"
      />,
    );
    const hint = document.querySelector('.smartpay-cta__shortcut-hint');
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveAttribute('aria-label', 'Pay now (Ctrl Enter)');
    expect(screen.getByText('Ctrl')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });

  it('accepts a single shortcut key as a string', () => {
    render(
      <SmartPayCTA
        title="Confirm"
        description="One key does it."
        cta={<button>Confirm</button>}
        shortcutKeys="Enter"
      />,
    );
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });
});
