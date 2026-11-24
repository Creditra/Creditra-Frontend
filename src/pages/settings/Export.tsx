import React, { useState } from 'react';
import { downloadCsv, toCsv } from '../../utils/csv';

export interface ExportAccountData {
  profile: {
    username: string;
    email: string;
    jointAt: string;
  };
  activities: Array<{
    id: number;
    action: string;
    timestamp: string;
  }>;
}

export interface ExportAccountSettingsProps {
  getExportData?: () => Promise<ExportAccountData> | ExportAccountData;
}

const DEFAULT_EXPORT_DATA: ExportAccountData = {
  profile: { username: 'user_export', email: 'user@creditra.io', jointAt: '2026-01-01' },
  activities: [
    { id: 1, action: 'Credit Score Requested', timestamp: '2026-06-20' },
    { id: 2, action: 'Report Downloaded', timestamp: '2026-06-25' },
  ],
};

export const ExportAccountSettings: React.FC<ExportAccountSettingsProps> = ({
  getExportData,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulates downloading a safely transformed structural file asset blob
  const triggerDownload = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    setError(null);

    try {
      // Replace with your canonical API service fetch pipeline hook as needed
      // const userData = await api.auth.getExportData();
      const userData = getExportData ? await getExportData() : DEFAULT_EXPORT_DATA;

      if (format === 'json') {
        const jsonString = JSON.stringify(userData, null, 2);
        triggerDownload(jsonString, 'creditra-account-data.json', 'application/json');
      } else {
        // Flat mapping data schema structure into compliance string patterns for standard CSV parsers
        const headers = ['Section', 'Key/ID', 'Detail/Action', 'Timestamp'];
        const rows = [
          ['Profile', 'Username', userData.profile.username, userData.profile.jointAt],
          ['Profile', 'Email', userData.profile.email, ''],
          ...userData.activities.map((act) => [
            'Activity',
            act.id.toString(),
            act.action,
            act.timestamp,
          ]),
        ];

        const csvContent = toCsv(headers, rows);
        downloadCsv('creditra-account-data.csv', csvContent);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to export account data:', message);
      setError('Failed to bundle your account archive. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm max-w-xl" data-testid="export-settings-container">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Export Account Data</h2>
      <p className="text-sm text-gray-600 mb-6">
        In accordance with financial data portability rights, you can request a full archive download of your transactions history, account logs, and metadata profile properties.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200" role="alert">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => handleExportData('json')}
          disabled={isExporting}
          className="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          data-testid="export-json-button"
        >
          {isExporting ? 'Generating Bundle...' : 'Download Portfolio (JSON)'}
        </button>

        <button
          onClick={() => handleExportData('csv')}
          disabled={isExporting}
          className="px-4 py-2.5 bg-white text-gray-700 font-medium text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          data-testid="export-csv-button"
        >
          {isExporting ? 'Generating Bundle...' : 'Download Ledger (CSV)'}
        </button>
      </div>
    </div>
  );
};