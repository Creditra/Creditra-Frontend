import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PreviewSection } from './PreviewSection';
import { ConfirmationStep } from './ConfirmationStep';
import { WalletProvider } from '../context/WalletContext';
import type { CreditLine } from '@/types/draw-credit.types';

const creditLine: CreditLine = {
  id: 'line-1',
  name: 'Test Line',
  status: "Active",
  limit: 10000,
  available: 4000,
  utilization: 60,
};

describe('glossed credit terms', () => {
  it('exposes the first utilization gloss in PreviewSection via keyboard and aria-describedby', async () => {
    const user = userEvent.setup();
    render(<PreviewSection creditLine={creditLine} amount={1000} />);

    const trigger = screen.getByLabelText('More information');
    const tooltip = screen.getByRole('tooltip');

    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
    expect(trigger).toHaveAttribute('tabindex', '0');

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(tooltip).toHaveTextContent('Utilization is the percentage of your available credit that is currently being used.');
  });

  it('wraps the first utilization and term occurrences in ConfirmationStep without repeating them', async () => {
    render(
      <WalletProvider>
        <ConfirmationStep
          creditLine={creditLine}
          amount={1000}
          onConfirm={() => undefined}
          onBack={() => undefined}
          onCancel={() => undefined}
        />
      </WalletProvider>,
    );

    const triggers = screen.getAllByLabelText('More information');
    expect(triggers).toHaveLength(2);

    const firstUtilizationTrigger = screen.getByText('Current utilization').closest('.accessible-tooltip');
    expect(firstUtilizationTrigger).not.toBeNull();

    triggers[0].focus();
    expect(triggers[0]).toHaveFocus();
  });

  it('keeps glossary copy aligned with docs/MICROCOPY.md', () => {
    const microcopyPath = path.resolve(__dirname, '../../docs/MICROCOPY.md');
    const microcopy = readFileSync(microcopyPath, 'utf8');

    expect(microcopy).toContain('Utilization is the percentage of your available credit that is currently being used.');
    expect(microcopy).toContain('A reserve is the portion of your credit line that should stay untouched for safety and flexibility.');
    expect(microcopy).toContain('A term is a defined period or condition of your credit agreement.');
  });
});
