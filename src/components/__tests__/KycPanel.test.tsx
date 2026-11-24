import { useRef, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { KycProvider } from '../../context/KycContext';
import { KycPanel } from '../KycPanel';
import { BELOW_MD_MEDIA } from '../../hooks/useMediaQuery';

function mockBelowMdMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mock = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return query === BELOW_MD_MEDIA ? matches : false;
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
      if (query === BELOW_MD_MEDIA && event === 'change') {
        listeners.add(cb);
      }
    }),
    removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
      if (query === BELOW_MD_MEDIA && event === 'change') {
        listeners.delete(cb);
      }
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mock,
  });

  return {
    setMatches(next: boolean) {
      matches = next;
      act(() => {
        listeners.forEach((cb) =>
          cb({ matches: next, media: BELOW_MD_MEDIA } as MediaQueryListEvent),
        );
      });
    },
  };
}

function Harness({ onResume = vi.fn() }: { onResume?: (stepId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <KycProvider>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(true)}>
        Open KYC
      </button>
      <KycPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onResume={onResume}
        triggerRef={triggerRef}
      />
    </KycProvider>
  );
}

describe('KycPanel', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    localStorage.clear();
  });

  it('renders KycDrawer on wide viewports and returns focus to triggerRef on close', () => {
    mockBelowMdMatchMedia(false);
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open KYC' });
    fireEvent.click(trigger);

    expect(document.getElementById('kyc-progress-drawer')).toBeInTheDocument();
    expect(document.getElementById('kyc-bottom-sheet')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: /kyc progress/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /close kyc progress drawer/i }));

    expect(document.getElementById('kyc-progress-drawer')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders KycBottomSheet on narrow viewports, returns focus on close, and invokes onResume', () => {
    mockBelowMdMatchMedia(true);
    const onResume = vi.fn();
    render(<Harness onResume={onResume} />);

    const trigger = screen.getByRole('button', { name: 'Open KYC' });
    fireEvent.click(trigger);

    expect(document.getElementById('kyc-bottom-sheet')).toBeInTheDocument();
    expect(document.getElementById('kyc-progress-drawer')).not.toBeInTheDocument();
    expect(screen.getAllByRole('dialog', { name: /kyc progress/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /close kyc bottom sheet/i }));
    expect(document.getElementById('kyc-bottom-sheet')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: /start verification|resume verification/i }));
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(document.getElementById('kyc-bottom-sheet')).not.toBeInTheDocument();
  });

  it('swaps between KycDrawer and KycBottomSheet when resizing while closed', () => {
    const mq = mockBelowMdMatchMedia(false);
    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open KYC' });

    fireEvent.click(trigger);
    expect(document.getElementById('kyc-progress-drawer')).toBeInTheDocument();
    expect(document.getElementById('kyc-bottom-sheet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close kyc progress drawer/i }));

    mq.setMatches(true);
    fireEvent.click(trigger);
    expect(document.getElementById('kyc-bottom-sheet')).toBeInTheDocument();
    expect(document.getElementById('kyc-progress-drawer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close kyc bottom sheet/i }));

    mq.setMatches(false);
    fireEvent.click(trigger);
    expect(document.getElementById('kyc-progress-drawer')).toBeInTheDocument();
    expect(document.getElementById('kyc-bottom-sheet')).not.toBeInTheDocument();
  });
});
