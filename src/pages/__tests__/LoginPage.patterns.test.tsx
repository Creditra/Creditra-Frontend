/**
 * LoginPage.patterns.test.tsx
 *
 * Focused accessibility tests for the color-blind-safe pattern fills
 * added to the LoginPage as part of the GrantFox FWC26 Stellar Wave
 * campaign (WCAG 2.1 SC 1.4.1 — Use of Color).
 *
 * What we verify
 * ──────────────
 * Error banner:
 *   1.  When error is shown, the banner carries BOTH the color-tint class
 *       (bg-red-50) AND the geometry-pattern class (lp-banner--error).
 *   2.  The banner has role="alert" for assertive screen-reader announce.
 *   3.  The banner carries data-lp-status="error" as a stable selector.
 *   4.  An AlertCircle icon (aria-hidden) is rendered as a second non-color cue.
 *   5.  The error message text is rendered inside the banner.
 *
 * Pending submit button:
 *   6.  When pending=true, the submit button carries lp-btn--pending class.
 *   7.  When pending=false, the submit button does NOT carry lp-btn--pending.
 *   8.  The submit button has aria-busy="true" while pending (screen-reader cue).
 *
 * Defensive tests for unused pattern classes:
 *   9.  Default state renders NO error banner (lp-banner--error absent).
 *   10. No spurious lp-banner--success / lp-banner--info classes leak in
 *       states where they are not yet wired (prevents future regressions).
 *
 * Pattern taxonomy (matches Dashboard v7 shapes — see ACCESSIBILITY.md):
 *   error   → cross-hatch 45°+135° (dense urgent signal)
 *   success → micro-dot grid       (positive checkmark scatter)
 *   info    → horizontal rules     (lines of information)
 *   pending → 45° diagonal stripes (in-progress motion cue)
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { LoginPage } from '../LoginPage';

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

/**
 * Returns the error-banner element (the outer div with data-lp-status).
 * Throws if not found — callers should only invoke when error is expected.
 */
function getErrorBanner(): HTMLElement {
  const el = document.querySelector('[data-lp-status="error"]') as HTMLElement | null;
  if (!el) throw new Error('Error banner with data-lp-status="error" not found');
  return el;
}

/** Returns the submit button — query by accessible role+name. */
function getSubmitBtn(): HTMLElement {
  return screen.getByRole('button', { name: /login|signing in/i });
}

/**
 * Triggers a synthetic form submission that bypasses the real fetch call
 * and drives the error banner into the DOM.
 *
 * We fill both required fields so FormField won't block the submit, then
 * fire submit on the form element.  The fetch call will reject because no
 * mock server is running, which causes handleSubmit → catch block to call
 * setError("An error occurred. Please try again.").
 */
async function submitFormAndAwaitError() {
  renderPage();

  const emailInput = document.getElementById('emailOrUsername') as HTMLInputElement | null;
  const passwordInput = document.getElementById('password') as HTMLInputElement | null;
  expect(emailInput).not.toBeNull();
  expect(passwordInput).not.toBeNull();

  fireEvent.change(emailInput!, { target: { value: 'user@example.com' } });
  fireEvent.change(passwordInput!, { target: { value: 'wrong-password' } });

  const form = document.querySelector('form') as HTMLFormElement | null;
  expect(form).not.toBeNull();
  fireEvent.submit(form!);

  await waitFor(() => {
    expect(document.querySelector('[data-lp-status="error"]')).toBeInTheDocument();
  });
}

// ─── 1–5. Error banner — color + pattern + icon + ARIA ─────────────────────

describe('LoginPage — color-blind pattern fills (WCAG 1.4.1 / GrantFox FWC26)', () => {
  describe('error status banner', () => {
    beforeEach(async () => {
      await submitFormAndAwaitError();
    });

    it('1. error banner carries the geometry-pattern class lp-banner--error', () => {
      expect(getErrorBanner()).toHaveClass('lp-banner--error');
    });

    it('2. error banner keeps the color-tint classes (bg-red-50, border-red-200)', () => {
      const banner = getErrorBanner();
      expect(banner.className).toMatch(/bg-red-50/);
      expect(banner.className).toMatch(/border-red-200/);
    });

    it('3. error banner has role="alert" for assertive screen-reader announce', () => {
      // screen.getByRole('alert') will throw if no alert exists.
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('4. error banner exposes data-lp-status="error" as stable selector', () => {
      expect(getErrorBanner()).toHaveAttribute('data-lp-status', 'error');
    });

    it('5. error banner renders the AlertCircle icon with aria-hidden="true"', () => {
      const banner = getErrorBanner();
      const icon = banner.querySelector('svg[aria-hidden="true"]');
      expect(icon).not.toBeNull();
      // Lucide AlertCircle renders a circle + diagonal line path set; the
      // closest DOM assertion we can make without snapshotting is that an
      // aria-hidden SVG exists inside the banner.
    });

    it('6. error message text is rendered inside the banner', () => {
      const banner = getErrorBanner();
      expect(banner.textContent).toMatch(/an error occurred|invalid credentials/i);
    });
  });

  // ─── 7–10. Pending submit button ─────────────────────────────────────────

  describe('pending submit button pattern', () => {
    it('7. button does NOT carry lp-btn--pending in idle (default) state', () => {
      renderPage();
      expect(getSubmitBtn()).not.toHaveClass('lp-btn--pending');
    });

    it('8. button carries lp-btn--pending class while aria-busy="true" (pending)', async () => {
      renderPage();

      const emailInput = document.getElementById('emailOrUsername') as HTMLInputElement | null;
      const passwordInput = document.getElementById('password') as HTMLInputElement | null;
      expect(emailInput).not.toBeNull();
      expect(passwordInput).not.toBeNull();

      fireEvent.change(emailInput!, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput!, { target: { value: 'any-password' } });

      const form = document.querySelector('form') as HTMLFormElement | null;
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      // In the synchronous microtask window right after submit fires, the
      // loading state should be true → aria-busy="true" → lp-btn--pending.
      await waitFor(() => {
        const btn = getSubmitBtn();
        expect(btn).toHaveAttribute('aria-busy', 'true');
      });
      expect(getSubmitBtn()).toHaveClass('lp-btn--pending');
    });

    it('9. submit button has aria-busy="false" (absent or "false") in idle state', () => {
      renderPage();
      const btn = getSubmitBtn();
      const busy = btn.getAttribute('aria-busy');
      expect(busy === null || busy === 'false').toBe(true);
    });
  });

  // ─── 11–14. Default state — no spurious banners / patterns ───────────────

  describe('default (idle) state — regression guard', () => {
    beforeEach(() => {
      renderPage();
    });

    it('11. no error banner is rendered when no error is set', () => {
      expect(document.querySelector('[data-lp-status="error"]')).toBeNull();
    });

    it('12. no element carries lp-banner--error in idle state', () => {
      expect(document.querySelector('.lp-banner--error')).toBeNull();
    });

    it('13. no element carries lp-banner--success (wired defensively, not yet used)', () => {
      expect(document.querySelector('.lp-banner--success')).toBeNull();
    });

    it('14. no element carries lp-banner--info (wired defensively, not yet used)', () => {
      expect(document.querySelector('.lp-banner--info')).toBeNull();
    });
  });

  // ─── 15–17. Pattern taxonomy mutual exclusivity ──────────────────────────

  describe('pattern class mutual exclusivity (regression guard)', () => {
    it('15. error banner only carries lp-banner--error, not success or info patterns', async () => {
      await submitFormAndAwaitError();
      const banner = getErrorBanner();
      expect(banner).toHaveClass('lp-banner--error');
      expect(banner).not.toHaveClass('lp-banner--success');
      expect(banner).not.toHaveClass('lp-banner--info');
    });
  });

  // ─── 18–20. Screen-reader / text-level cues (WCAG 1.4.1 secondary cue) ───

  describe('text-level status identification (no color/pattern dependency)', () => {
    it('18. error banner conveys message via visible text (not color only)', async () => {
      await submitFormAndAwaitError();
      const banner = getErrorBanner();
      const messageEl = banner.querySelector('p');
      expect(messageEl).not.toBeNull();
      expect(messageEl?.textContent?.trim()).toBeTruthy();
    });

    it('19. error banner icon is decorative (aria-hidden) so AT uses text', async () => {
      await submitFormAndAwaitError();
      const banner = getErrorBanner();
      const svgs = banner.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('20. form still exposes all labeled fields after error appears', async () => {
      await submitFormAndAwaitError();
      expect(screen.getByLabelText(/email or username/i)).toBeInTheDocument();
      // Password input queried via label[for="password"] association (same
      // approach used in the existing LoginPage.test.tsx suite).
      const passwordLabel = document.querySelector('label[for="password"]');
      expect(passwordLabel).not.toBeNull();
    });
  });
});
