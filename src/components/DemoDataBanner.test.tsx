import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DemoDataBanner } from './DemoDataBanner';
import { isDemoData } from '../services/credit/config';

// ---------------------------------------------------------------------------
// isDemoData() unit tests
// ---------------------------------------------------------------------------

describe('isDemoData()', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when VITE_CREDIT_DATA_SOURCE is not set', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', '');
    expect(isDemoData()).toBe(true);
  });

  it('returns true when VITE_CREDIT_DATA_SOURCE is "mock"', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'mock');
    expect(isDemoData()).toBe(true);
  });

  it('returns false when VITE_CREDIT_DATA_SOURCE is "soroban"', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'soroban');
    expect(isDemoData()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DemoDataBanner component tests
// ---------------------------------------------------------------------------

describe('DemoDataBanner', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
  });

  // -- Visibility by data source mode ---------------------------------------

  it('renders the banner in mock mode (default)', () => {
    // No env stub → defaults to mock
    render(<DemoDataBanner />);
    expect(screen.getByRole('status', { name: /demo data active/i })).toBeInTheDocument();
  });

  it('renders the banner when VITE_CREDIT_DATA_SOURCE is explicitly "mock"', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'mock');
    render(<DemoDataBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render the banner when VITE_CREDIT_DATA_SOURCE is "soroban"', () => {
    vi.stubEnv('VITE_CREDIT_DATA_SOURCE', 'soroban');
    const { container } = render(<DemoDataBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  // -- Content ---------------------------------------------------------------

  it('displays demo data copy', () => {
    render(<DemoDataBanner />);
    expect(screen.getByText(/demo data/i)).toBeInTheDocument();
    expect(screen.getByText(/simulated credit data/i)).toBeInTheDocument();
  });

  it('renders a "Learn more" link pointing to /help', () => {
    render(<DemoDataBanner />);
    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/help');
  });

  // -- Accessibility ---------------------------------------------------------

  it('has role="status" for non-assertive announcement', () => {
    render(<DemoDataBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('dismiss button has an accessible label', () => {
    render(<DemoDataBanner />);
    expect(
      screen.getByRole('button', { name: /dismiss demo data notice/i }),
    ).toBeInTheDocument();
  });

  // -- Session-scoped dismissal ----------------------------------------------

  it('hides the banner after clicking dismiss', () => {
    render(<DemoDataBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /dismiss demo data notice/i }),
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('persists dismissal to sessionStorage', () => {
    render(<DemoDataBanner />);
    fireEvent.click(
      screen.getByRole('button', { name: /dismiss demo data notice/i }),
    );

    expect(sessionStorage.getItem('demoDataBannerDismissed')).toBe('true');
  });

  it('stays hidden on remount when session flag is set', () => {
    sessionStorage.setItem('demoDataBannerDismissed', 'true');
    const { container } = render(<DemoDataBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reappears after sessionStorage is cleared (simulates fresh session)', () => {
    // First session: dismiss
    const { unmount } = render(<DemoDataBanner />);
    fireEvent.click(
      screen.getByRole('button', { name: /dismiss demo data notice/i }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    unmount();

    // Clear storage to simulate new session
    sessionStorage.clear();

    // Second render: banner should be visible again
    render(<DemoDataBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
