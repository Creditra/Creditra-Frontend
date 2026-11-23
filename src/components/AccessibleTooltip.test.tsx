import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AccessibleTooltip } from './AccessibleTooltip';

describe('AccessibleTooltip', () => {
  it('connects the focusable help trigger to tooltip content', () => {
    render(<AccessibleTooltip label="Explain this field." />);


    
    const trigger = screen.getByLabelText('More information');
    const tooltip = screen.getByRole('tooltip');

    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(tooltip).toHaveTextContent('Explain this field.');
  });

  it('supports inline child content and exposes the gloss via aria-describedby', async () => {
    const user = userEvent.setup();
    render(
      <AccessibleTooltip label="Utilization is the percentage of your available credit that is currently being used.">
        <span>utilization</span>
      </AccessibleTooltip>,
    );

    const trigger = screen.getByText('utilization').closest('.accessible-tooltip__trigger');
    const tooltip = screen.getByRole('tooltip');

    expect(trigger).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(trigger).toHaveAttribute('tabindex', '0');

    await user.tab();

    expect(trigger).toHaveFocus();
    expect(tooltip).toHaveTextContent('Utilization is the percentage of your available credit that is currently being used.');
  });

  it('keeps the glossary copy aligned with docs/MICROCOPY.md', () => {
    const microcopyPath = path.resolve(__dirname, '../../docs/MICROCOPY.md');
    const microcopy = readFileSync(microcopyPath, 'utf8');

    expect(microcopy).toContain('Utilization is the percentage of your available credit that is currently being used.');
  });
});
