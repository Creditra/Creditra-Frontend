import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RiskBandsPanel } from '../RiskBandsPanel';

describe('RiskBandsPanel CSP compliance', () => {
  it('does not render any <style> element into the DOM when open', () => {
    const { container } = render(<RiskBandsPanel isOpen={true} onClose={vi.fn()} />);
    expect(container.querySelector('style')).toBeNull();
    expect(document.querySelector('style')).toBeNull();
  });
});
