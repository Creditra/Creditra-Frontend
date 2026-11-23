import React, { useState, useEffect, useRef } from 'react';

export const LocaleSettings: React.FC = () => {
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage(null);
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    // Simulate API call
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      setIsSaving(false);
      setSaveMessage({ type: 'success', text: 'Settings updated successfully.' });
    }, 800);
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm max-w-xl" data-testid="locale-settings-container">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Regional Preferences</h2>
      <p className="text-sm text-gray-600 mb-6">
        Configure your preferred currency and display language for the GrantFox FWC26 campaign interface.
      </p>

      {saveMessage && (
        <div 
          className={`mb-6 p-3 text-sm rounded-md border ${
            saveMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}
          role="alert"
        >
          {saveMessage.text}
        </div>
      )}

      <div className="space-y-5 mb-8">
        <div>
          <label htmlFor="currency-select" className="block text-sm font-medium text-gray-700 mb-1">
            Display Currency
          </label>
          <div className="relative">
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              data-testid="currency-select"
            >
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
              <option value="GBP">GBP (£) - British Pound</option>
              <option value="JPY">JPY (¥) - Japanese Yen</option>
              <option value="CAD">CAD ($) - Canadian Dollar</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-1">
            Display Language
          </label>
          <div className="relative">
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-md py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          data-testid="save-preferences-button"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};
