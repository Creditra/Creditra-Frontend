import type { ReactNode } from 'react';
import { KbdHint } from '../components/KbdHint';
import './SmartPayCTA.css';

export interface SmartPayCTAProps {
  /** The heading for the CTA card. */
  title: string;
  /** Body copy explaining the benefit. */
  description: string;
  /** Primary CTA element (button or link). */
  cta: ReactNode;
  /**
   * Optional image sources for responsive rendering.
   * The component renders a `<picture>` element with `<source>` tags
   * for multiple resolutions (mobile → desktop).
   */
  images?: { src: string; width: number }[];
  /** Alt text for the decorative image. */
  imageAlt?: string;
  /** Additional CSS class names. */
  className?: string;
  /**
   * Keyboard shortcut for the primary CTA (e.g. `['Ctrl', 'Enter']`).
   * When provided, a subtle hint chip is rendered next to the action.
   */
  shortcutKeys?: string | string[];
  /** Optional label shown alongside the shortcut hint chip. */
  shortcutLabel?: string;
}

/**
 * SmartPayCTA — responsive call-to-action card with srcset images.
 *
 * Renders a marketing/CTO card that adapts its illustration to the
 * viewport width using a `<picture>` + `<source>` element. On small
 * screens a mobile-optimised image is served; on wider viewports a
 * higher-resolution version is used.
 *
 * WCAG 2.1 AA:
 * - Decorative images use `alt=""` (unless imageAlt is provided).
 * - CTA focus rings via `:focus-visible` in index.css.
 * - Card uses the global `.card` class for consistent spacing.
 */
export function SmartPayCTA({
  title,
  description,
  cta,
  images,
  imageAlt = '',
  className = '',
  shortcutKeys,
  shortcutLabel,
}: SmartPayCTAProps) {
  const classes = ['card', 'smartpay-cta', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="smartpay-cta__body">
        <h2 className="smartpay-cta__title">{title}</h2>
        <p className="smartpay-cta__desc">{description}</p>
        <div className="smartpay-cta__action">
          {cta}
          {shortcutKeys && (
            <KbdHint
              keys={shortcutKeys}
              label={shortcutLabel}
              variant="badge"
              className="smartpay-cta__shortcut-hint"
            />
          )}
        </div>
      </div>

      {images && images.length > 0 && (
        <div className="smartpay-cta__image" aria-hidden={!imageAlt}>
          <picture>
            {images
              .sort((a, b) => a.width - b.width)
              .map((img, idx) => (
                <source
                  key={idx}
                  srcSet={img.src}
                  media={
                    idx < images.length - 1
                      ? `(max-width: ${img.width}px)`
                      : undefined
                  }
                />
              ))}
            <img
              src={images[images.length - 1].src}
              alt={imageAlt}
              className="smartpay-cta__img"
            />
          </picture>
        </div>
      )}
    </div>
  );
}

export default SmartPayCTA;
