import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveRegion } from './LiveRegion';

describe('LiveRegion', () => {
  it('renders a visually hidden div with aria attributes', () => {
    render(<LiveRegion message="Test message" />);
    const region = screen.getByRole('status');
    
    expect(region).toBeInTheDocument();
    expect(region).toHaveClass('sr-only');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveTextContent('Test message');
  });

  it('updates the announcement when the message changes', () => {
    const { rerender } = render(<LiveRegion message="Initial message" />);
    expect(screen.getByRole('status')).toHaveTextContent('Initial message');

    rerender(<LiveRegion message="Updated message" />);
    expect(screen.getByRole('status')).toHaveTextContent('Updated message');
  });

  it('clears the announcement when message is set to an empty string', () => {
    const { rerender } = render(<LiveRegion message="Persistent message" />);
    expect(screen.getByRole('status')).toHaveTextContent('Persistent message');

    rerender(<LiveRegion message="" />);
    // Empty string clears the region so stale content is not re-announced.
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('allows overriding className and politeness', () => {
    render(<LiveRegion message="Test" className="custom-class" politeness="assertive" />);
    const region = screen.getByRole('status');
    
    expect(region).toHaveClass('custom-class');
    expect(region).toHaveAttribute('aria-live', 'assertive');
  });
});
