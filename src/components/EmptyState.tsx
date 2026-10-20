import { useId } from 'react';
import { Link } from 'react-router-dom';
import type { ReactNode, ComponentPropsWithoutRef } from 'react';

type ActionShape = {
  label: string;
  to?: string;
  onClick?: () => void;
};

export type EmptyStateProps = {
  illustration: ReactNode;
  title: string;
  description: string;
  eyebrow?: string;
  tone?: 'info' | 'success';
  primaryAction?: ActionShape;
  secondaryAction?: ActionShape;
  titleId?: string;
} & ComponentPropsWithoutRef<'div'>;

function renderAction(action: ActionShape, className: string) {
  if (action.to) {
    return (
      <Link key={action.label} to={action.to} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <button key={action.label} type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function EmptyState({
  illustration,
  title,
  description,
  eyebrow,
  tone,
  primaryAction,
  secondaryAction,
  titleId: customTitleId,
  className = '',
  ...props
}: EmptyStateProps) {
  const autoId = useId();
  const titleId = customTitleId ?? `empty-state-title-${autoId}`;
  const toneClass = tone ? `empty-state--${tone}` : '';

  return (
    <div
      className={`empty-state ${toneClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      {...props}
    >
      {illustration}
      {tone && <div className="empty-state__accent-rule" />}
      {eyebrow && <p className="empty-state__eyebrow">{eyebrow}</p>}
      <h2 className="empty-state__title" id={titleId}>
        {title}
      </h2>
      <p className="empty-state__description">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="empty-state__actions">
          {primaryAction && renderAction(primaryAction, 'empty-state-btn')}
          {secondaryAction && renderAction(secondaryAction, 'empty-state-secondary-btn')}
        </div>
      )}
    </div>
  );
}
