import { useId } from 'react';
import { Breadcrumb } from '../components/Breadcrumb';
import './AttestationCard.css';

export interface AttestationCardProps {
  /** The attestation title displayed in the card header. */
  title: string;
  /** Descriptive body content. */
  description: string;
  /** Breadcrumb items for navigation context. */
  breadcrumbs?: { label: string; to?: string }[];
  /** Additional CSS class names. */
  className?: string;
}

/**
 * AttestationCard — an attestation information card with breadcrumb navigation.
 *
 * Displays a card containing breadcrumb context and attestation details.
 * Uses the `Breadcrumb` component for navigation and the global `.card` class
 * for consistent styling.
 *
 * WCAG 2.1 AA:
 * - Card has a programmatic heading for screen readers.
 * - Breadcrumb provides navigation context.
 * - Focus rings delegated to `.focus-ring` / `:focus-visible` in index.css.
 */
export function AttestationCard({
  title,
  description,
  breadcrumbs,
  className = '',
}: AttestationCardProps) {
  const headingId = useId();
  const classes = ['card', 'attestation-card', className]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={classes} aria-labelledby={headingId}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb items={breadcrumbs} className="attestation-card__breadcrumb" />
      )}
      <h2 id={headingId} className="attestation-card__title">
        {title}
      </h2>
      <p className="attestation-card__desc">{description}</p>
    </section>
  );
}

export default AttestationCard;
