import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SmartPayCTA from '../SmartPayCTA';
import { ReducedMotionProvider } from '@/context/ReducedMotionContext';

describe('SmartPayCTA Component', () => {
  const renderWithProvider = () => {
    return render(
      <ReducedMotionProvider value={{ isReducedMotionActive: false, toggleReducedMotion: () => {} }}>
        <SmartPayCTA />
      </ReducedMotionProvider>
    );
  };

  it('renders the CTA component correctly', () => {
    renderWithProvider();

    // Verify heading
    const heading = screen.getByRole('heading', { name: /Stellar Wave Campaign/i });
    expect(heading).toBeInTheDocument();

    // Verify button
    const button = screen.getByRole('button', { name: /Enable Smart Pay/i });
    expect(button).toBeInTheDocument();
  });

  it('implements responsive images with srcset to avoid downloading desktop assets on mobile', () => {
    renderWithProvider();

    const image = screen.getByRole('img', { name: /Stellar Wave Campaign/i });
    expect(image).toBeInTheDocument();
    
    // Verify srcset is properly configured for the GrantFox FWC26 campaign
    expect(image).toHaveAttribute('srcSet');
    const srcset = image.getAttribute('srcSet') || '';
    
    expect(srcset).toContain('stellar-wave-sm.jpg 400w');
    expect(srcset).toContain('stellar-wave-md.jpg 800w');
    expect(srcset).toContain('stellar-wave-lg.jpg 1200w');
    
    // Verify sizes attribute handles breakpoints correctly
    expect(image).toHaveAttribute('sizes');
    const sizes = image.getAttribute('sizes') || '';
    expect(sizes).toContain('(max-width: 600px) 400px');
    expect(sizes).toContain('(max-width: 1024px) 800px');
  });
});
