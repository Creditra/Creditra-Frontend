import { render } from '@testing-library/react';
import { DrawCreditPageSkeleton } from '../DrawCreditPage';

describe('DrawCreditPageSkeleton', () => {
  it('renders the correct structural classes for shape parity', () => {
    const { container } = render(<DrawCreditPageSkeleton />);
    
    // Check main container
    const main = container.querySelector('main');
    expect(main).toHaveClass('dc-page');
    expect(main).toHaveAttribute('aria-busy', 'true');
    expect(main).toHaveAttribute('aria-label', 'Loading draw credit page');

    // Check inner and card
    expect(container.querySelector('.dc-page__inner')).toBeInTheDocument();
    expect(container.querySelector('.dc-page__card')).toBeInTheDocument();
    expect(container.querySelector('.dc-step')).toBeInTheDocument();

    // Check if the skeleton items correctly mimic the structure of CreditLineSelector
    const list = container.querySelector('.dc-credit-line-list');
    expect(list).toBeInTheDocument();
    
    const items = container.querySelectorAll('.dc-credit-line-item');
    expect(items.length).toBe(3);
    
    // Check circular shape is being passed correctly to the chevron replacement skeleton
    const circularSkeletons = container.querySelectorAll('.skeleton--circular');
    expect(circularSkeletons.length).toBe(3);
  });
});
