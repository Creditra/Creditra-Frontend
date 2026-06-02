import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders correctly with given custom styles', () => {
    const { container } = render(<Skeleton width="100px" height="50px" className="custom-class" />);
    const element = container.firstChild as HTMLElement;

    expect(element).toBeInTheDocument();
    expect(element.className).toContain('skeleton');
    expect(element.className).toContain('custom-class');
    expect(element.style.width).toBe('100px');
    expect(element.style.height).toBe('50px');
  });

  it('spreads addition HTML attributes properly', () => {
    render(<Skeleton data-testid="skeleton-element" aria-hidden="true" />);
    const element = screen.getByTestId('skeleton-element');

    expect(element).toBeInTheDocument();
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });
});
