import type { ReactNode } from 'react';

export interface LandingHeroProps {
  /** Main hero heading. */
  title: string;
  /** Subtitle / supporting text. */
  subtitle: string;
  /** Primary CTA button or link element. */
  cta?: ReactNode;
  /** Secondary CTA button or link element. */
  secondaryCta?: ReactNode;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * LandingHero — landing page hero section with colour-blind safe chips.
 *
 * Renders a hero banner with heading, supporting text, and CTA buttons.
 * The accent chip decorations use pattern-based backgrounds from
 * `src/styles/patterns.css` so they remain distinguishable even for
 * users with colour-vision deficiencies (WCAG 1.4.1).
 *
 * WCAG 2.1 AA:
 * - Uses semantic `<header>` landmark.
 * - Hero heading is `<h1>` for proper document outline.
 * - CTA focus rings via `:focus-visible` in index.css.
 *
 * Usage:
 * ```tsx
 * <LandingHero
 *   title="Credit Without Collateral"
 *   subtitle="Earn credit based on your on-chain reputation."
 *   cta={<Link to="/open-credit" className="btn-primary">Get Started</Link>}
 * />
 * ```
 */
export function LandingHero({
  title,
  subtitle,
  cta,
  secondaryCta,
  className = '',
}: LandingHeroProps) {
  const classes = ['landing-hero', className].filter(Boolean).join(' ');

  return (
    <header className={classes}>
      {/* Colour-blind safe decorative chip patterns */}
      <div className="landing-hero__chips" aria-hidden="true">
        <span className="landing-hero__chip status-active" />
        <span className="landing-hero__chip status-suspended" />
        <span className="landing-hero__chip status-frozen" />
      </div>

      <div className="landing-hero__content">
        <h1 className="landing-hero__title tabular-nums">{title}</h1>
        <p className="landing-hero__subtitle tabular-nums">{subtitle}</p>
        {(cta || secondaryCta) && (
          <div className="landing-hero__actions">
            {cta && <div className="landing-hero__cta">{cta}</div>}
            {secondaryCta && (
              <div className="landing-hero__secondary">{secondaryCta}</div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default LandingHero;
