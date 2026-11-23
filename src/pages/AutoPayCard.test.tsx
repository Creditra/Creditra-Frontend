import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoPayCard } from './AutoPayCard';

describe('AutoPayCard', () => {
  it('renders the placeholder when hasValidPreview is false', () => {
    render(
      <AutoPayCard
        hasValidPreview={false}
        parsedAmount={0}
        frequency="monthly"
        startDate=""
      />
    );
    expect(screen.getByText(/Fill in an amount and start date/i)).toBeInTheDocument();
  });

  it('renders the AutopaySchedule when hasValidPreview is true', () => {
    render(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={150}
        frequency="weekly"
        startDate="2026-08-01"
      />
    );
    expect(screen.queryByText(/Fill in an amount and start date/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Payment Schedule Preview/i)).toBeInTheDocument();
  });

  it('shows hover-preview card on mouse enter and hides on mouse leave', () => {
    const handlePreviewChange = vi.fn();
    render(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={200}
        frequency="monthly"
        startDate="2026-09-01"
        onPreviewRowChange={handlePreviewChange}
      />
    );

    const rows = screen.getAllByRole('row');
    // First body row is index 1 (index 0 is header row)
    const firstRow = rows[1];

    expect(firstRow).toBeInTheDocument();
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');

    // Trigger mouseEnter on first schedule row
    fireEvent.mouseEnter(firstRow);
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');
    expect(handlePreviewChange).toHaveBeenCalledWith(0);

    // Trigger mouseLeave
    fireEvent.mouseLeave(firstRow);
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');
    expect(handlePreviewChange).toHaveBeenCalledWith(null);
  });

  it('supports keyboard navigation (focusing and Escape key dismissal)', () => {
    render(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={100}
        frequency="weekly"
        startDate="2026-08-10"
      />
    );

    const rows = screen.getAllByRole('row');
    const firstRow = rows[1];

    // Focus row
    fireEvent.focus(firstRow);
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');

    // Press Escape key to dismiss popover
    fireEvent.keyDown(firstRow, { key: 'Escape' });
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles preview card when pressing Enter or Space key', () => {
    render(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={120}
        frequency="biweekly"
        startDate="2026-08-15"
      />
    );

    const rows = screen.getAllByRole('row');
    const firstRow = rows[1];

    // Press Enter to activate preview card
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(firstRow).toHaveAttribute('aria-expanded', 'true');

    // Press Enter again to toggle off
    fireEvent.keyDown(firstRow, { key: 'Enter' });
    expect(firstRow).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the preview card and placeholder with the classNames the narrow-viewport styles target', () => {
    const { rerender } = render(
      <AutoPayCard
        hasValidPreview={false}
        parsedAmount={0}
        frequency="monthly"
        startDate=""
      />
    );
    expect(document.querySelector('.autopay-page__preview-card')).toBeInTheDocument();
    expect(document.querySelector('.autopay-page__preview-placeholder')).toBeInTheDocument();
    expect(document.querySelector('.autopay-page__preview-placeholder-icon')).toBeInTheDocument();
    expect(document.querySelector('.autopay-page__preview-placeholder-text')).toBeInTheDocument();

    rerender(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={50}
        frequency="monthly"
        startDate="2026-08-01"
      />
    );
    expect(document.querySelector('.autopay-page__preview-card')).toBeInTheDocument();
  });

  it('forwards onPreviewRowChange through to the schedule rows', () => {
    const handlePreviewChange = vi.fn();
    render(
      <AutoPayCard
        hasValidPreview={true}
        parsedAmount={75}
        frequency="monthly"
        startDate="2026-10-01"
        onPreviewRowChange={handlePreviewChange}
      />
    );

    const rows = screen.getAllByRole('row');
    fireEvent.focus(rows[1]);
    expect(handlePreviewChange).toHaveBeenCalledWith(0);
  });
});
