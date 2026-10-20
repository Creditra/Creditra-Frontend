import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders a progressbar with the correct ARIA attributes', () => {
    render(<ProgressBar value={42} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('uses the value as the default aria-label', () => {
    render(<ProgressBar value={75} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', '75%');
  });

  it('accepts a custom aria-label', () => {
    render(<ProgressBar value={30} label="Upload progress" />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-label', 'Upload progress');
  });

  it('clamps values above 100 to 100', () => {
    render(<ProgressBar value={150} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('clamps values below 0 to 0', () => {
    render(<ProgressBar value={-10} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders the fill with the correct width', () => {
    const { container } = render(<ProgressBar value={66} />);

    const fill = container.querySelector('.progress-bar-fill');
    expect(fill).toHaveStyle({ width: '66%' });
  });

  it('shows the value text when showValue is true', () => {
    render(<ProgressBar value={55} showValue />);

    expect(screen.getByText('55%')).toBeInTheDocument();
  });

  it('does not show the value text by default', () => {
    render(<ProgressBar value={55} />);

    expect(screen.queryByText('55%')).not.toBeInTheDocument();
  });

  it('applies the correct variant class for each variant', () => {
    const variants = ['accent', 'success', 'warning', 'danger'] as const;

    for (const variant of variants) {
      const { container, unmount } = render(
        <ProgressBar value={50} variant={variant} />,
      );
      expect(container.querySelector('.progress-bar-wrapper')).toHaveClass(
        `progress-bar--${variant}`,
      );
      unmount();
    }
  });

  it('applies the correct size class for each size', () => {
    const sizes = ['sm', 'md', 'lg'] as const;

    for (const size of sizes) {
      const { container, unmount } = render(
        <ProgressBar value={50} size={size} />,
      );
      expect(container.querySelector('.progress-bar-wrapper')).toHaveClass(
        `progress-bar--${size}`,
      );
      unmount();
    }
  });

  it('uses the default variant accent when none is provided', () => {
    const { container } = render(<ProgressBar value={50} />);

    expect(container.querySelector('.progress-bar-wrapper')).toHaveClass(
      'progress-bar--accent',
    );
  });

  it('uses the default size md when none is provided', () => {
    const { container } = render(<ProgressBar value={50} />);

    expect(container.querySelector('.progress-bar-wrapper')).toHaveClass(
      'progress-bar--md',
    );
  });
});
