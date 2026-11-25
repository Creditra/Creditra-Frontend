import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

function SheetStack({
  parentOpen,
  childOpen,
}: {
  parentOpen: boolean;
  childOpen: boolean;
}) {
  return (
    <>
      <Sheet
        isOpen={parentOpen}
        side="right"
        portalId="parent-sheet"
        ariaLabelledBy="parent-title"
        onClose={vi.fn()}
      >
        <h2 id="parent-title">Parent sheet</h2>
        <button type="button">Parent action</button>
      </Sheet>
      <Sheet
        isOpen={childOpen}
        side="bottom"
        portalId="child-sheet"
        ariaLabelledBy="child-title"
        onClose={vi.fn()}
      >
        <h2 id="child-title">Child sheet</h2>
        <button type="button">Child action</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
  });

  it('renders an accessible dialog in a portal and handles Escape', () => {
    const onClose = vi.fn();
    render(
      <Sheet
        isOpen
        side="right"
        portalId="test-sheet"
        ariaLabelledBy="test-sheet-title"
        onClose={onClose}
      >
        <h2 id="test-sheet-title">Test sheet</h2>
      </Sheet>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Test sheet' });
    expect(dialog.parentElement).toBe(document.getElementById('test-sheet'));
    expect(dialog.parentElement).toHaveAttribute('data-sheet-side', 'right');

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses the requested initial element', () => {
    vi.useFakeTimers();
    const initialFocusRef = createRef<HTMLButtonElement>();
    render(
      <Sheet
        isOpen
        side="bottom"
        ariaLabelledBy="initial-focus-title"
        initialFocusRef={initialFocusRef}
        onClose={vi.fn()}
      >
        <h2 id="initial-focus-title">Initial focus</h2>
        <button type="button">First action</button>
        <button ref={initialFocusRef} type="button">Preferred action</button>
      </Sheet>,
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(document.activeElement).toBe(initialFocusRef.current);
  });

  it('keeps background inert and body locked until the last stacked sheet closes', () => {
    const app = document.createElement('main');
    app.setAttribute('aria-hidden', 'false');
    document.body.appendChild(app);
    const { rerender } = render(<SheetStack parentOpen childOpen={false} />);

    rerender(<SheetStack parentOpen childOpen />);
    expect(app.hasAttribute('inert') || app.getAttribute('aria-hidden') === 'true').toBe(true);

    rerender(<SheetStack parentOpen={false} childOpen />);
    expect(app.hasAttribute('inert') || app.getAttribute('aria-hidden') === 'true').toBe(true);
    expect(document.body.style.position).toBe('fixed');
    expect(screen.getByRole('dialog', { name: 'Child sheet' })).toBeInTheDocument();

    rerender(<SheetStack parentOpen={false} childOpen={false} />);
    expect(app.hasAttribute('inert')).toBe(false);
    expect(app.getAttribute('aria-hidden')).toBe('false');
    expect(document.body.style.position).toBe('');
    expect(window.scrollTo).toHaveBeenCalledOnce();
    app.remove();
  });

  it('traps keyboard focus in the topmost sheet', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <SheetStack parentOpen childOpen={false} />,
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Parent action' }));

    rerender(<SheetStack parentOpen childOpen />);
    act(() => {
      vi.advanceTimersByTime(60);
    });
    const childAction = screen.getByRole('button', { name: 'Child action' });
    expect(document.activeElement).toBe(childAction);

    childAction.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(childAction);
  });
});
