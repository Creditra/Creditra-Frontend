import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PreviewCard } from './PreviewCard';

describe('PreviewCard', () => {
  it('renders the trigger children', () => {
    render(
      <PreviewCard preview={<span>Preview content</span>}>
        <button>Hover me</button>
      </PreviewCard>,
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toBeInTheDocument();
  });

  it('renders the preview content', () => {
    render(
      <PreviewCard preview={<span>Preview content</span>}>
        <button>Hover me</button>
      </PreviewCard>,
    );
    expect(screen.getByText('Preview content')).toBeInTheDocument();
  });

  it('has region role with aria-live="polite" on the preview', () => {
    render(
      <PreviewCard preview={<span>Content</span>}>
        <button>Trigger</button>
      </PreviewCard>,
    );
    const region = screen.getByRole('region', { hidden: true });
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('uses aria-label passed via prop', () => {
    render(
      <PreviewCard preview={<span>Content</span>} ariaLabel="Schedule preview">
        <button>Trigger</button>
      </PreviewCard>,
    );
    const region = screen.getByRole('region', { hidden: true });
    expect(region).toHaveAttribute('aria-label', 'Schedule preview');
  });

  it('uses default aria-label when not provided', () => {
    render(
      <PreviewCard preview={<span>Content</span>}>
        <button>Trigger</button>
      </PreviewCard>,
    );
    const region = screen.getByRole('region', { hidden: true });
    expect(region).toHaveAttribute('aria-label', 'Preview');
  });

  it('applies custom class name', () => {
    const { container } = render(
      <PreviewCard preview={<span>Content</span>} className="custom-class">
        <button>Trigger</button>
      </PreviewCard>,
    );
    const root = container.querySelector('.preview-card');
    expect(root).toHaveClass('custom-class');
  });
});
