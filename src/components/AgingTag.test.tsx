import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AgingTag } from './AgingTag';

describe('AgingTag', () => {
  it('renders correctly for a delinquent line with default shortcut hint', () => {
    render(<AgingTag daysPastDue={15} />);
    
    // The text should be present
    expect(screen.getByText('15 days past due')).toBeInTheDocument();
    
    // The default shortcut hint 'R' should be present
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('renders correctly with a custom shortcut hint', () => {
    render(<AgingTag daysPastDue={15} shortcutKey="P" />);
    
    // The custom shortcut hint 'P' should be present
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('does not render if daysPastDue is 0', () => {
    const { container } = render(<AgingTag daysPastDue={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render if daysPastDue is negative', () => {
    const { container } = render(<AgingTag daysPastDue={-5} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('applies additional class names', () => {
    render(<AgingTag daysPastDue={10} className="custom-test-class" />);
    
    const tag = screen.getByText('10 days past due').parentElement;
    expect(tag).toHaveClass('aging-tag');
    expect(tag).toHaveClass('custom-test-class');
  });

  it('has an aria-hidden icon for accessibility', () => {
    const { container } = render(<AgingTag daysPastDue={30} />);
    // SVG element is rendered by lucide-react, should have aria-hidden
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});

