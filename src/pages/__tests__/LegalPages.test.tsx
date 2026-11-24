import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Terms } from '../Terms';
import { Privacy } from '../Privacy';
import { TERMS_VERSION } from '../../constants/legal';

describe('Terms Page', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('renders the terms page with heading', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Terms of Service/i })).toBeInTheDocument();
  });

  it('displays the effective date', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(screen.getByText(/Effective Date: July 2026/i)).toBeInTheDocument();
  });

  it('displays the terms version', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(screen.getByText(new RegExp(`Version ${TERMS_VERSION}`))).toBeInTheDocument();
  });

  it('renders all terms sections', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(screen.getByText(/Collateral Requirements/i)).toBeInTheDocument();
    expect(screen.getByText(/Repayment Policies/i)).toBeInTheDocument();
    expect(screen.getByText(/FICO Score Nudges/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected Accounts & Sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/User Responsibilities/i)).toBeInTheDocument();
    expect(screen.getByText(/Limitation of Liability/i)).toBeInTheDocument();
    expect(screen.getByText(/Governing Law/i)).toBeInTheDocument();
  });

  it('contains a link to privacy policy', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    const privacyLink = screen.getByRole('link', { name: /View Privacy Policy/i });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('shows placeholder disclaimer', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(screen.getByText(/placeholder legal copy/i)).toBeInTheDocument();
  });

  it('sets document title', () => {
    render(
      <BrowserRouter>
        <Terms />
      </BrowserRouter>
    );

    expect(document.title).toBe('Terms of Service - Creditra');
  });
});

describe('Privacy Page', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('renders the privacy page with heading', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /Privacy Policy/i })).toBeInTheDocument();
  });

  it('displays the effective date', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    expect(screen.getByText(/Effective Date: July 2026/i)).toBeInTheDocument();
  });

  it('renders all privacy sections', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    expect(screen.getByText(/Information We Collect/i)).toBeInTheDocument();
    expect(screen.getByText(/How We Use Your Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Security/i)).toBeInTheDocument();
    expect(screen.getByText(/Sharing Your Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookies and Tracking/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Rights/i)).toBeInTheDocument();
    expect(screen.getByText(/Children's Privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/Changes to This Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Contact Us/i)).toBeInTheDocument();
  });

  it('contains a link to terms of service', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    const termsLink = screen.getByRole('link', { name: /View Terms of Service/i });
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('contains privacy contact email link', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    const emailLinks = screen.getAllByRole('link').filter(link => 
      link.getAttribute('href')?.startsWith('mailto:')
    );
    expect(emailLinks.length).toBeGreaterThan(0);
  });

  it('shows placeholder disclaimer', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    expect(screen.getByText(/placeholder legal copy/i)).toBeInTheDocument();
  });

  it('sets document title', () => {
    render(
      <BrowserRouter>
        <Privacy />
      </BrowserRouter>
    );

    expect(document.title).toBe('Privacy Policy - Creditra');
  });
});
