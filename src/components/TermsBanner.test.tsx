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

  it('does not render if terms were already accepted (legacy raw value migrates to versioned envelope)', () => {
    localStorage.setItem('creditra_terms_accepted_version', '2026-07');
    
    const { container } = render(
      <BrowserRouter>
        <TermsBanner />
      </BrowserRouter>
    );
    expect(container).toBeEmptyDOMElement();
    expect(JSON.parse(localStorage.getItem('creditra_terms_accepted_version')!)).toEqual({
      v: 1,
      data: '2026-07',
    });
  });

  it('renders the banner if stored terms version is from an unknown future schema', () => {
    localStorage.setItem(
      'creditra_terms_accepted_version',
      JSON.stringify({ v: 99, data: '2026-07' }),
    );

    render(<TermsBanner />);
    expect(screen.getByTestId('terms-banner')).toBeInTheDocument();
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
    
    expect(JSON.parse(localStorage.getItem('creditra_terms_accepted_version')!)).toEqual({
      v: 1,
      data: '2026-07',
    });
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

  it('opens review terms modal when clicking review button', () => {
    render(<TermsBanner />);
    
    expect(screen.queryByTestId('tb-modal')).not.toBeInTheDocument();
    
    const reviewBtn = screen.getByTestId('tb-review-btn');
    fireEvent.click(reviewBtn);
    
    expect(screen.getByTestId('tb-modal')).toBeInTheDocument();
    expect(screen.getByText(/Terms & Conditions Update/i)).toBeInTheDocument();
  });

  it('closes review modal when clicking cancel button in modal', () => {
    render(<TermsBanner />);
    
    const reviewBtn = screen.getByTestId('tb-review-btn');
    fireEvent.click(reviewBtn);
    
    const cancelBtn = screen.getByTestId('tb-modal-cancel-btn');
    fireEvent.click(cancelBtn);
    
    expect(screen.queryByTestId('tb-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('terms-banner')).toBeInTheDocument();
  });

  it('closes review modal when clicking close button in modal header', () => {
    render(<TermsBanner />);
    
    const reviewBtn = screen.getByTestId('tb-review-btn');
    fireEvent.click(reviewBtn);
    
    const closeBtn = screen.getByTestId('tb-modal-close-btn');
    fireEvent.click(closeBtn);
    
    expect(screen.queryByTestId('tb-modal')).not.toBeInTheDocument();
  });

  it('accepts terms and closes modal when clicking accept button inside modal', () => {
    render(<TermsBanner />);
    
    const reviewBtn = screen.getByTestId('tb-review-btn');
    fireEvent.click(reviewBtn);
    
    const modalAcceptBtn = screen.getByTestId('tb-modal-accept-btn');
    fireEvent.click(modalAcceptBtn);
    
    expect(JSON.parse(localStorage.getItem('creditra_terms_accepted_version')!)).toEqual({
      v: 1,
      data: '2026-07',
    });
    expect(screen.queryByTestId('tb-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terms-banner')).not.toBeInTheDocument();
  });

  it('closes review modal on pressing Escape key', () => {
    render(<TermsBanner />);
    
    const reviewBtn = screen.getByTestId('tb-review-btn');
    fireEvent.click(reviewBtn);
    
    expect(screen.getByTestId('tb-modal')).toBeInTheDocument();
    
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    
    expect(screen.queryByTestId('tb-modal')).not.toBeInTheDocument();

  });
});
