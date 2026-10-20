import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RepayPageSkeleton } from '../RepayPage';

function renderSkeleton(initialEntries = ['/repay']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RepayPageSkeleton />
    </MemoryRouter>,
  );
}

describe('RepayPageSkeleton', () => {
  it('renders the loading state attributes correctly', () => {
    renderSkeleton();
    const container = screen.getByLabelText('Loading repay page');
    expect(container).toBeInTheDocument();
    expect(container).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the selection view skeleton when no line is specified', () => {
    const { container } = renderSkeleton(['/repay']);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    expect(screen.queryByText('Payoff Projection')).not.toBeInTheDocument();
  });

  it('renders the input view skeleton when a line is specified', () => {
    const { container } = renderSkeleton(['/repay?line=CL-123']);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
  });
});
