import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Theme } from '../Theme';
import { ContrastProvider } from '../../../context/ContrastContext';

// Mock storage to prevent actual localStorage usage
vi.mock('../../../utils/storage', () => ({
  readJson: vi.fn(() => 'normal'),
  writeJson: vi.fn(),
}));

describe('Theme Settings Page', () => {
  it('renders the high contrast toggle', () => {
    render(
      <ContrastProvider>
        <Theme />
      </ContrastProvider>
    );
    expect(screen.getByText(/High Contrast/i)).toBeDefined();
  });

  it('toggles contrast mode when clicked', () => {
    render(
      <ContrastProvider>
        <Theme />
      </ContrastProvider>
    );
    const toggle = screen.getByRole('switch');
    // Initially 'normal' -> aria-checked="false"
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    // After click -> 'high' -> aria-checked="true"
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});
