/**
 * LoginPage — accessibility tests
 *
 * Focus: WCAG 2.1 AA conformance for the password field.
 *
 * The key invariant is that the password <input> must always carry a non-empty
 * aria-describedby value so that screen readers can programmatically relate the
 * field to its descriptive text, regardless of whether an error is currently
 * shown.  Before the fix, aria-describedby was absent in the non-error state
 * because the FormField was missing a helpText prop.
 *
 * Additional tests cover:
 *  - Basic rendering / label associations
 *  - aria-invalid toggling when a field-level error fires
 *  - aria-describedby composition (both help and error ids present together)
 *  - Keyboard / semantic requirements (autocomplete, required)
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '../LoginPage';

/** Helper: render LoginPage inside MemoryRouter (required for Link / useNavigate). */
function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

/**
 * Helper: get the password input by its stable DOM id.
 *
 * We use getElementById rather than getByLabelText because FormField renders
 * a required-indicator <span aria-label="required">*</span> inside the label,
 * which causes the accessible name computation to include "required" in the
 * label text, making the exact-match regex /^password$/i fail.  Querying by
 * id is the most precise selector for this input and mirrors what assistive
 * technology uses when following the <label for="password"> reference.
 */
function getPasswordInput(): HTMLElement {
  const el = document.getElementById('password');
  if (!el) throw new Error('Password input with id="password" not found');
  return el;
}

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe('LoginPage — rendering', () => {
  it('renders the page heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /welcome back/i }),
    ).toBeInTheDocument();
  });

  it('renders the email/username field with an accessible label', () => {
    renderPage();
    expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
  });

  it('renders the password field (accessible via id)', () => {
    renderPage();
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it('password field label says "Password"', () => {
    renderPage();
    // The label element for the password field should contain "Password" text.
    const label = document.querySelector('label[for="password"]');
    expect(label).not.toBeNull();
    expect(label?.textContent).toMatch(/password/i);
  });

  it('renders the submit button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /login/i }),
    ).toBeInTheDocument();
  });

  it('renders a link to the forgot-password page', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: /forgot password/i }),
    ).toBeInTheDocument();
  });

  it('renders a link to the registration page', () => {
    renderPage();
    expect(
      screen.getByRole('link', { name: /create account/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// GrantFox FWC26 Campaign — Responsive Image (srcset) tests (#704)
// ---------------------------------------------------------------------------

describe('LoginPage — responsive campaign image (GrantFox FWC26 / #704)', () => {
  it('renders the Stellar Wave campaign hero image with accessible alt text', () => {
    renderPage();
    const image = screen.getByAltText(/GrantFox FWC26 Stellar Wave campaign banner/i);
    expect(image).toBeInTheDocument();
  });

  it('includes responsive srcset attribute with multiple width candidates', () => {
    renderPage();
    const image = screen.getByAltText(/GrantFox FWC26 Stellar Wave campaign banner/i);
    const srcset = image.getAttribute('srcset');
    expect(srcset).toBeTruthy();
    expect(srcset).toContain('480w');
    expect(srcset).toContain('768w');
    expect(srcset).toContain('1200w');
  });

  it('configures sizes attribute for responsive layout breakpoints', () => {
    renderPage();
    const image = screen.getByAltText(/GrantFox FWC26 Stellar Wave campaign banner/i);
    const sizes = image.getAttribute('sizes');
    expect(sizes).toBeTruthy();
    expect(sizes).toContain('100vw');
    expect(sizes).toContain('400px');
  });

  it('provides a default fallback src attribute', () => {
    renderPage();
    const image = screen.getByAltText(/GrantFox FWC26 Stellar Wave campaign banner/i) as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('/assets/images/stellar-wave-md.jpg');
  });
});

// ---------------------------------------------------------------------------
// Password field — WCAG 2.1 AA: aria-describedby always present
// ---------------------------------------------------------------------------

describe('LoginPage — password field accessibility (WCAG 2.1 AA)', () => {
  /**
   * Core regression test.
   *
   * WCAG 2.1 SC 1.3.1 (Info and Relationships) requires that relationships
   * between UI components are programmatically determinable.  An input's
   * descriptive text must be linked via aria-describedby so assistive
   * technology can surface it without relying on visual proximity alone.
   *
   * Before this fix, the password input had no aria-describedby in the
   * non-error state because FormField omits the attribute when neither
   * helpText nor error is supplied.  Adding helpText ensures the attribute
   * is always present.
   */
  it('has aria-describedby pointing to the help text in the default (non-error) state', () => {
    renderPage();

    const passwordInput = getPasswordInput();
    const describedBy = passwordInput.getAttribute('aria-describedby');

    // The attribute must exist and be non-empty.
    expect(describedBy).toBeTruthy();

    // It must reference the help-text element generated by FormField
    // (id="${fieldId}-help" by convention).
    expect(describedBy).toContain('password-help');
  });

  it('renders the help-text element with the expected id', () => {
    renderPage();

    const helpEl = document.getElementById('password-help');
    expect(helpEl).toBeInTheDocument();
  });

  it('help text element contains descriptive content', () => {
    renderPage();

    const helpEl = document.getElementById('password-help');
    // The visible help text must be non-empty so screen readers have
    // something meaningful to announce.
    expect(helpEl?.textContent?.trim()).toBeTruthy();
    expect(helpEl).toHaveTextContent(/enter.*password/i);
  });

  it('does not set aria-invalid="true" on the password field in the default state', () => {
    renderPage();

    const passwordInput = getPasswordInput();
    // aria-invalid="false" (the string) or the attribute absent are both
    // valid; the important thing is that it is not "true".
    expect(passwordInput).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('marks the password field as required via aria-required', () => {
    renderPage();

    const passwordInput = getPasswordInput();
    // FormField sets aria-required rather than the native required attribute.
    expect(passwordInput).toHaveAttribute('aria-required', 'true');
  });

  it('has autocomplete="current-password" for password-manager support', () => {
    renderPage();

    const passwordInput = getPasswordInput();
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('uses type="password" so the value is masked', () => {
    renderPage();

    const passwordInput = getPasswordInput();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});

// ---------------------------------------------------------------------------
// Password field — aria-describedby composition when an error is present
// ---------------------------------------------------------------------------

describe('LoginPage — password field aria-describedby with error state', () => {
  /**
   * When a field-level error fires, FormField appends the error id to the
   * existing describedBy string:
   *
   *   aria-describedby="password-help password-error"
   *
   * This test verifies that the help-text reference is *not* dropped when
   * an error is shown, preserving the description alongside the error.
   *
   * NOTE: Triggering a field-level error through the real form requires a
   * network call, so we test the FormField composition rule directly via
   * the FormField component to keep the test fast and deterministic.
   */
  it('includes both "password-help" and "password-error" in aria-describedby when an error is active', async () => {
    // Import FormField directly — this tests the composition rule that
    // LoginPage relies on, without needing to mock fetch.
    const { FormField } = await import('../../components/FormField');

    render(
      <FormField
        id="password"
        name="password"
        label="Password"
        type="password"
        required
        helpText="Enter the password for your account"
        error="Incorrect password"
        value=""
        onChange={() => {}}
        autoComplete="current-password"
      />,
    );

    const input = document.getElementById('password') as HTMLInputElement;
    expect(input).not.toBeNull();
    const describedBy = input.getAttribute('aria-describedby') ?? '';

    expect(describedBy).toContain('password-help');
    expect(describedBy).toContain('password-error');
  });

  it('sets aria-invalid="true" on the password input when an error is present', async () => {
    const { FormField } = await import('../../components/FormField');

    render(
      <FormField
        id="password"
        name="password"
        label="Password"
        type="password"
        required
        helpText="Enter the password for your account"
        error="Incorrect password"
        value=""
        onChange={() => {}}
        autoComplete="current-password"
      />,
    );

    const input = document.getElementById('password') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
