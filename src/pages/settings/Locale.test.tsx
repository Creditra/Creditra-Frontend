import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSettings } from './Locale';

describe('LocaleSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders currency and language selects with associated labels', () => {
    render(<LocaleSettings />);

    const currencySelect = screen.getByLabelText('Display Currency') as HTMLSelectElement;
    const languageSelect = screen.getByLabelText('Display Language') as HTMLSelectElement;

    expect(currencySelect).toBeInTheDocument();
    expect(currencySelect.id).toBe('currency-select');
    expect(currencySelect.value).toBe('USD');

    expect(languageSelect).toBeInTheDocument();
    expect(languageSelect.id).toBe('language-select');
    expect(languageSelect.value).toBe('en');
  });

  it('updates select values on interaction without showing a fake success message or writing to storage', () => {
    const localSetItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    render(<LocaleSettings />);

    const currencySelect = screen.getByLabelText('Display Currency') as HTMLSelectElement;
    const languageSelect = screen.getByLabelText('Display Language') as HTMLSelectElement;

    fireEvent.change(currencySelect, { target: { value: 'EUR' } });
    fireEvent.change(languageSelect, { target: { value: 'fr' } });

    expect(currencySelect.value).toBe('EUR');
    expect(languageSelect.value).toBe('fr');

    expect(screen.queryByText(/settings updated successfully/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-preferences-button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Regional preferences are not saved yet.'
    );
    expect(localSetItemSpy).not.toHaveBeenCalled();
  });

  it('uses design-token CSS classes and no hard-coded light Tailwind classes', () => {
    const { container } = render(<LocaleSettings />);

    const root = screen.getByTestId('locale-settings-container');
    expect(root).toHaveClass('locale-settings');
    expect(screen.getByTestId('currency-select')).toHaveClass('locale-settings__select');
    expect(screen.getByTestId('language-select')).toHaveClass('locale-settings__select');

    const html = container.innerHTML;
    expect(html).not.toMatch(/\bbg-white\b/);
    expect(html).not.toMatch(/\btext-gray-\d+\b/);
    expect(html).not.toMatch(/\bborder-gray-\d+\b/);
  });
});
