import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LocaleSettings } from '../Locale';

describe('LocaleSettings', () => {
  it('renders the component with default values', () => {
    render(<LocaleSettings />);
    
    expect(screen.getByTestId('locale-settings-container')).toBeInTheDocument();
    expect(screen.getByText('Regional Preferences')).toBeInTheDocument();
    
    const currencySelect = screen.getByTestId('currency-select') as HTMLSelectElement;
    expect(currencySelect.value).toBe('USD');
    
    const languageSelect = screen.getByTestId('language-select') as HTMLSelectElement;
    expect(languageSelect.value).toBe('en');
  });

  it('allows user to change currency and language', () => {
    render(<LocaleSettings />);
    
    const currencySelect = screen.getByTestId('currency-select');
    fireEvent.change(currencySelect, { target: { value: 'EUR' } });
    expect((currencySelect as HTMLSelectElement).value).toBe('EUR');
    
    const languageSelect = screen.getByTestId('language-select');
    fireEvent.change(languageSelect, { target: { value: 'es' } });
    expect((languageSelect as HTMLSelectElement).value).toBe('es');
  });

  it('displays saving state and success message upon saving', () => {
    vi.useFakeTimers();
    render(<LocaleSettings />);
    
    const saveButton = screen.getByTestId('save-preferences-button');
    fireEvent.click(saveButton);
    
    expect(saveButton).toHaveTextContent('Saving...');
    expect(saveButton).toBeDisabled();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('Settings updated successfully.')).toBeInTheDocument();
    expect(saveButton).toHaveTextContent('Save Preferences');
    expect(saveButton).not.toBeDisabled();
    
    vi.useRealTimers();
  });

  it('clears the save timer on unmount without state-update warnings', () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<LocaleSettings />);

    const saveButton = screen.getByTestId('save-preferences-button');
    fireEvent.click(saveButton);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });
});
