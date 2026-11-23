import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TermsBanner } from './TermsBanner';

describe('TermsBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the banner if terms have not been accepted or dismissed', () => {
    render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    
    expect(screen.getByTestId('terms-banner')).toBeInTheDocument();
    expect(screen.getByText(/We've updated our Terms of Service/i)).toBeInTheDocument();
  });

  it('does not render if terms were already accepted', () => {
    localStorage.setItem('creditra_terms_accepted_version', '2026-07');
    
    const { container } = render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render if terms were dismissed in the current session', () => {
    sessionStorage.setItem('creditra_terms_dismissed', 'true');
    
    const { container } = render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('allows accepting terms from the banner', () => {
    render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    
    const acceptBtn = screen.getByTestId('tb-accept-btn');
    fireEvent.click(acceptBtn);
    
    expect(localStorage.getItem('creditra_terms_accepted_version')).toBe('2026-07');
    expect(screen.queryByTestId('terms-banner')).not.toBeInTheDocument();
  });

  it('allows dismissing terms for the session', () => {
    render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    
    const dismissBtn = screen.getByTestId('tb-dismiss-btn');
    fireEvent.click(dismissBtn);
    
    expect(sessionStorage.getItem('creditra_terms_dismissed')).toBe('true');
    expect(screen.queryByTestId('terms-banner')).not.toBeInTheDocument();
  });

  it('renders review terms link pointing to /terms', () => {
    render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    
    const reviewLink = screen.getByTestId('tb-review-link');
    expect(reviewLink).toHaveAttribute('href', '/terms');
    expect(screen.getByText('Review Terms', { selector: 'a' })).toBeInTheDocument();
  });
});
