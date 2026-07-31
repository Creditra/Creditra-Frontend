import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { LandingHero } from './LandingHero';
import { Link } from 'react-router-dom';

describe('LandingHero', () => {
  it('renders title and subtitle', () => {
    render(
      <LandingHero
        title="Welcome"
        subtitle="This is the subtitle."
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome' }),
    ).toBeInTheDocument();
    expect(screen.getByText('This is the subtitle.')).toBeInTheDocument();
  });

  it('renders CTA buttons when provided', () => {
    render(
      <MemoryRouter>
        <LandingHero
          title="Hero"
          subtitle="Sub."
          cta={<Link to="/open-credit">Get Started</Link>}
          secondaryCta={<Link to="/learn">Learn More</Link>}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: 'Get Started' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Learn More' }),
    ).toBeInTheDocument();
  });

  it('renders decorative chips with aria-hidden', () => {
    render(<LandingHero title="Test" subtitle="Sub." />);
    const chips = document.querySelector('.landing-hero__chips');
    expect(chips).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses semantic header landmark', () => {
    const { container } = render(
      <LandingHero title="Test" subtitle="Sub." />,
    );
    expect(container.querySelector('header')).toBeInTheDocument();
  });

  it('applies tabular-nums to title and subtitle for numeric alignment', () => {
    render(<LandingHero title="$1,234.56" subtitle="0% APR — 5.0% fee" />);
    const title = screen.getByRole('heading', { level: 1 });
    const subtitle = document.querySelector('.landing-hero__subtitle');
    expect(title.className).toMatch(/tabular-nums/);
    expect(subtitle?.className).toMatch(/tabular-nums/);
  });
});
