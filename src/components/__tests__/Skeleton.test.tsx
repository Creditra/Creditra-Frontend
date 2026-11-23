import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders with default class names', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('skeleton--rectangular');
  });

  it('applies shape class name correctly', () => {
    const { container } = render(<Skeleton shape="circular" />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).toHaveClass('skeleton--circular');
  });

  it('applies variant class name when subtle is passed', () => {
    const { container } = render(<Skeleton variant="subtle" />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).toHaveClass('skeleton--subtle');
  });

  it('passes other div attributes and style', () => {
    const { container } = render(<Skeleton style={{ color: 'red' }} data-testid="custom-skeleton" />);
    const skeleton = container.querySelector('.skeleton');
    expect(skeleton).toHaveAttribute('data-testid', 'custom-skeleton');
    expect(skeleton).toHaveStyle('color: red');
  });
});
