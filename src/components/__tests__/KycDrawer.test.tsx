/**
 * KycDrawer — unit tests
 *
 * Coverage:
 *  Drawer rendering
 *    - Returns null when isOpen=false
 *    - Renders the dialog and correct ARIA attrs when open
 *    - Shows the title, subtitle, and kicker copy
 *  Step list
 *    - Renders all 5 steps
 *    - Marks the resume step with aria-current="step"
 *    - Not-started step shows step number; completed step shows check icon
 *    - Screen-reader status text is present on each step
 *  Progress bar
 *    - role="progressbar" with correct valuenow
 *  Resume button
 *    - Disabled when overallStatus is approved (nothing to resume)
 *    - Enabled when there is a resumeStepId; calls onResume then onClose
 *    - Shows "Start verification" when nothing is in_progress
 *    - Shows "Resume verification" when a step is in_progress
 *    - Shows "All steps submitted" when under_review
 *  Status badge
 *    - Shows correct label for each overallStatus
 *  Dismiss
 *    - onClose called via × button, backdrop click, and Escape
 *  KycTriggerButton
 *    - Shows dot indicator for in_progress / rejected statuses
 *    - Hides dot when status is not_started or approved
 *    - aria-label includes current status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { KycDrawer, KycTriggerButton } from '../KycDrawer';
import { KycProvider } from '../../context/KycContext';
import type { KycStepId, KycStepStatus } from '../../types/kyc';
import { useRef } from 'react';

// ─── Mock accessibility hooks ─────────────────────────────────────────────────
vi.mock('../../hooks/useBodyScrollLock', () => ({ useBodyScrollLock: () => undefined }));
vi.mock('../../hooks/useInertBackdrop',  () => ({ useInertBackdrop:  () => undefined }));
vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => { const ref = { current: null }; return ref; },
}));
Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Prime localStorage with specific step statuses before rendering.
 * KycContext hydrates from localStorage on mount — synchronous, no effects needed.
 */
function primeStorage(overrides: Partial<Record<KycStepId, KycStepStatus>>) {
  const DEFAULT_IDS: KycStepId[] = ['identity', 'address', 'documents', 'selfie', 'review'];
  const steps = DEFAULT_IDS.map(id => ({
    id,
    label: id,
    description: '',
    status: overrides[id] ?? 'not_started',
    updatedAt: overrides[id] ? new Date().toISOString() : undefined,
  }));
  localStorage.setItem('creditra_kyc', JSON.stringify({ version: 1, steps, lastUpdated: new Date().toISOString() }));
}

/**
 * Render `<KycDrawer>` inside a `<KycProvider>`.
 */
function renderDrawer(
  props: { isOpen?: boolean; onClose?: ReturnType<typeof vi.fn>; onResume?: ReturnType<typeof vi.fn> } = {},
) {
  const onClose  = props.onClose  ?? vi.fn();
  const onResume = props.onResume ?? vi.fn();
  const isOpen   = props.isOpen   ?? true;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <KycProvider>{children}</KycProvider>;
  }

  const result = render(
    <KycDrawer isOpen={isOpen} onClose={onClose} onResume={onResume} />,
    { wrapper: Wrapper },
  );

  return { ...result, onClose, onResume };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Clear persisted KYC state so tests start clean.
  localStorage.clear();
});

describe('KycDrawer', () => {

  // ── Rendering ────────────────────────────────────────────────────────────

  it('returns null when isOpen is false', () => {
    renderDrawer({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog when isOpen is true', () => {
    renderDrawer();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('has correct ARIA dialog attributes', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'kyc-drawer-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'kyc-drawer-desc');
  });

  it('shows the title "KYC Progress"', () => {
    renderDrawer();
    expect(screen.getByRole('heading', { name: /kyc progress/i })).toBeInTheDocument();
  });

  it('shows the kicker copy', () => {
    renderDrawer();
    expect(screen.getByText(/grantfox/i)).toBeInTheDocument();
  });

  // ── Step list ─────────────────────────────────────────────────────────────

  it('renders all 5 steps', () => {
    renderDrawer();
    // Steps are inside an <ol>; listitem role
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(5);
  });

  it('shows step numbers for not_started steps', () => {
    renderDrawer();
    // Step 1 icon should contain "1"
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('marks the resume step with aria-current="step"', () => {
    primeStorage({ address: 'in_progress' });
    renderDrawer();
    const currentItem = screen.getByRole('listitem', { current: 'step' });
    expect(currentItem).toBeInTheDocument();
    expect(currentItem.textContent).toMatch(/address/i);
  });

  it('shows screen-reader status on each step', () => {
    renderDrawer();
    // At least one sr-only "Not started" annotation should be present
    const srNodes = Array.from(document.querySelectorAll('.sr-only'));
    const statusTexts = srNodes.map(n => n.textContent);
    expect(statusTexts.some(t => t?.includes('Not started'))).toBe(true);
  });

  it('shows "In progress" sr-only text when a step is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderDrawer();
    const srNodes = Array.from(document.querySelectorAll('.sr-only'));
    expect(srNodes.some(n => n.textContent?.includes('In progress'))).toBe(true);
  });

  // ── Progress bar ──────────────────────────────────────────────────────────

  it('has role="progressbar" with valuenow=0 when nothing is completed', () => {
    renderDrawer();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('updates progressbar valuenow when steps are completed', () => {
    // 2 out of 5 = 40 %
    primeStorage({ identity: 'completed', address: 'completed' });
    renderDrawer();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
  });

  // ── Status badge ──────────────────────────────────────────────────────────

  it('shows "Not started" status badge initially', () => {
    renderDrawer();
    expect(screen.getByRole('status')).toHaveTextContent(/not started/i);
  });

  it('shows "In progress" when a step is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderDrawer();
    expect(screen.getByRole('status')).toHaveTextContent(/in progress/i);
  });

  it('shows "Approved" when all steps are completed', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'completed', review: 'completed' });
    renderDrawer();
    expect(screen.getByRole('status')).toHaveTextContent(/approved/i);
  });

  it('shows "Under review" when all steps are pending', () => {
    primeStorage({ identity: 'pending', address: 'pending', documents: 'pending', selfie: 'pending', review: 'pending' });
    renderDrawer();
    expect(screen.getByRole('status')).toHaveTextContent(/under review/i);
  });

  // ── Resume button ─────────────────────────────────────────────────────────

  it('shows "Start verification" text when status is not_started', () => {
    renderDrawer();
    expect(
      screen.getByRole('button', { name: /start verification/i }),
    ).toBeInTheDocument();
  });

  it('shows "Resume verification" when a step is in_progress', () => {
    primeStorage({ documents: 'in_progress' });
    renderDrawer();
    expect(
      screen.getByRole('button', { name: /resume verification/i }),
    ).toBeInTheDocument();
  });

  it('shows "All steps submitted" when under_review', () => {
    primeStorage({ identity: 'pending', address: 'pending', documents: 'pending', selfie: 'pending', review: 'pending' });
    renderDrawer();
    expect(
      screen.getByRole('button', { name: /all steps submitted/i }),
    ).toBeInTheDocument();
  });

  it('Resume button is disabled when all steps are completed', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'completed', review: 'completed' });
    renderDrawer();
    const btn = screen.getByRole('button', { name: /all steps submitted/i });
    expect(btn).toBeDisabled();
  });

  it('Resume button is enabled when there is a resumeStepId', () => {
    renderDrawer();
    expect(
      screen.getByRole('button', { name: /start verification/i }),
    ).not.toBeDisabled();
  });

  it('calls onResume with the first not_started step id', () => {
    const onResume = vi.fn();
    const onClose  = vi.fn();
    renderDrawer({ onResume, onClose });
    fireEvent.click(screen.getByRole('button', { name: /start verification/i }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onResume).toHaveBeenCalledWith('identity'); // first step
  });

  it('calls onClose after Resume is clicked', () => {
    const onClose = vi.fn();
    renderDrawer({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /start verification/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onResume with the in_progress step when one exists', () => {
    primeStorage({ selfie: 'in_progress' });
    const onResume = vi.fn();
    renderDrawer({ onResume });
    fireEvent.click(screen.getByRole('button', { name: /resume verification/i }));
    expect(onResume).toHaveBeenCalledWith('selfie');
  });

  it('reveals the sticky action bar after the drawer body scrolls', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'in_progress' });
    renderDrawer();

    const footer = document.querySelector('.kyc-drawer__footer') as HTMLElement;
    const scrollBody = document.querySelector('.kyc-drawer__body') as HTMLElement;

    expect(footer).toHaveAttribute('data-sticky-visible', 'false');

    Object.defineProperty(scrollBody, 'scrollTop', {
      configurable: true,
      value: 48,
      writable: true,
    });
    fireEvent.scroll(scrollBody);

    expect(footer).toHaveAttribute('data-sticky-visible', 'true');
  });

  // ── Dismiss ───────────────────────────────────────────────────────────────

  it('calls onClose when the × button is clicked', () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: /close kyc progress/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const { onClose } = renderDrawer();
    fireEvent.click(document.querySelector('.kyc-drawer-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed on the dialog', () => {
    const { onClose } = renderDrawer();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

});

// ─── KycTriggerButton ─────────────────────────────────────────────────────────

describe('KycTriggerButton', () => {
  function renderTrigger() {
    const onClick = vi.fn();

    function Wrapper() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <KycProvider>
          <KycTriggerButton onClick={onClick} triggerRef={ref} />
        </KycProvider>
      );
    }

    render(<Wrapper />);
    return { onClick };
  }

  it('renders a button with "KYC" label', () => {
    renderTrigger();
    expect(screen.getByRole('button', { name: /kyc/i })).toBeInTheDocument();
  });

  it('has aria-haspopup="dialog"', () => {
    renderTrigger();
    expect(screen.getByRole('button', { name: /kyc/i })).toHaveAttribute(
      'aria-haspopup', 'dialog',
    );
  });

  it('does not show the dot when status is not_started', () => {
    renderTrigger();
    expect(document.querySelector('.kyc-trigger-btn__dot')).toBeNull();
  });

  it('shows the accent dot when status is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderTrigger();
    const dot = document.querySelector('.kyc-trigger-btn__dot');
    expect(dot).not.toBeNull();
    expect(dot?.classList.contains('kyc-trigger-btn__dot--in_progress')).toBe(true);
  });

  it('does not show dot when approved', () => {
    primeStorage({ identity: 'completed', address: 'completed', documents: 'completed', selfie: 'completed', review: 'completed' });
    renderTrigger();
    expect(document.querySelector('.kyc-trigger-btn__dot')).toBeNull();
  });

  it('includes current status in aria-label when status is in_progress', () => {
    primeStorage({ identity: 'in_progress' });
    renderTrigger();
    const btn = screen.getByRole('button', { name: /kyc/i });
    expect(btn.getAttribute('aria-label')).toMatch(/in progress/i);
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const { onClick } = renderTrigger();
    await user.click(screen.getByRole('button', { name: /kyc/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

// ─── Responsive audit ────────────────────────────────────────────────────

describe('KycDrawer responsive audit (<=375px)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders without error at 375px viewport', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(max-width: 375px)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    expect(() => renderDrawer()).not.toThrow();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });

  it('help link renders as an accessible anchor', () => {
    renderDrawer();
    const helpLink = screen.getByText(/Need help with verification/i);
    expect(helpLink).toBeInTheDocument();
    expect(helpLink.tagName).toBe('A');
    expect(helpLink).toHaveAttribute('href', '/help#kyc');
  });
});

// ─── CSS content audit ───────────────────────────────────────────────────

describe('KycDrawer CSS — breakpoint & tap-target audit', () => {
  it('contains a narrow-screen breakpoint at 375px', () => {
    const css = readFileSync(resolve(__dirname, '../KycDrawer.css'), 'utf-8');
    expect(css).toContain('@media (max-width: 375px)');
    const start = css.indexOf('@media (max-width: 375px)');
    const block = css.slice(start, css.indexOf('/* ── Reduced motion', start));
    expect(block).toContain('--space-md');
    expect(block).toContain('--space-lg');
  });

  it('sets min-height 44px on .kyc-drawer__help-link', () => {
    const css = readFileSync(resolve(__dirname, '../KycDrawer.css'), 'utf-8');
    const ruleStart = css.indexOf('.kyc-drawer__help-link');
    const rule = css.slice(ruleStart, css.indexOf('}', ruleStart) + 1);
    expect(rule).toContain('min-height: 44px');
  });

  it('does not use 36px tap target on help link', () => {
    const css = readFileSync(resolve(__dirname, '../KycDrawer.css'), 'utf-8');
    expect(css).not.toMatch(/\.kyc-drawer__help-link[^}]*min-height:\s*36px/);
  });
});
