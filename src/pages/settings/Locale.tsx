import React, { useState } from 'react';
import './Locale.css';

export const LocaleSettings: React.FC = () => {
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');

  return (
    <div className="locale-settings" data-testid="locale-settings-container">
      <h2 className="locale-settings__title">Regional Preferences</h2>
      <p className="locale-settings__description">
        Configure your preferred currency and display language for the GrantFox FWC26 campaign interface.
      </p>

      <div className="locale-settings__fields">
        <div className="locale-settings__field">
          <label htmlFor="currency-select" className="locale-settings__label">
            Display Currency
          </label>
          <select
            id="currency-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="locale-settings__select"
            data-testid="currency-select"
          >
            <option value="USD">USD ($) - US Dollar</option>
            <option value="EUR">EUR (€) - Euro</option>
            <option value="GBP">GBP (£) - British Pound</option>
            <option value="JPY">JPY (¥) - Japanese Yen</option>
            <option value="CAD">CAD ($) - Canadian Dollar</option>
          </select>
        </div>

        <div className="locale-settings__field">
          <label htmlFor="language-select" className="locale-settings__label">
            Display Language
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="locale-settings__select"
            data-testid="language-select"
          >
            <option value="en">English (US)</option>
            <option value="es">Español (ES)</option>
            <option value="fr">Français (FR)</option>
            <option value="de">Deutsch (DE)</option>
            <option value="ja">日本語 (JA)</option>
          </select>
        </div>
      </div>

      <p
        className="locale-settings__note"
        role="status"
        data-testid="locale-persistence-note"
      >
        Regional preferences are not saved yet.
      </p>
    </div>
  );
};
