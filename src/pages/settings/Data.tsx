/**
 * Data.tsx — Settings › Data & Privacy
 *
 * Lets the authenticated user download a JSON snapshot of their
 * Creditra data on demand.
 *
 * @accessibility
 *   - Export button announces state changes via aria-live="polite"
 *   - Spinner has aria-label="Preparing export"
 *   - Success/error messages are role="status" / role="alert"
 *   - All interactive elements meet 44×44 px touch target
 *
 * @darkmode Uses var(--color-*) tokens; adapts automatically.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import './Data.css';

type ExportState = 'idle' | 'loading' | 'success' | 'error';

export default function DataPrivacySettings() {
  const [exportState, setExportState] = useState<ExportState>('idle');
  const isMountedRef = useRef(true);
  const exportWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (exportWaitTimerRef.current !== null) {
        clearTimeout(exportWaitTimerRef.current);
        exportWaitTimerRef.current = null;
      }
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const handleExport = useCallback(async () => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setExportState('loading');

    try {
      // Simulate 1.5s delay for processing
      await new Promise<void>((resolve) => {
        if (exportWaitTimerRef.current !== null) {
          clearTimeout(exportWaitTimerRef.current);
        }
        exportWaitTimerRef.current = setTimeout(() => {
          exportWaitTimerRef.current = null;
          resolve();
        }, 1500);
      });

      if (!isMountedRef.current) return;

      // Mock data structure (would come from API in production)
      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: {
          walletAddress: '0x1234...5678', // connected wallet or null
          memberSince: '2024-01-01',
        },
        creditLines: [],      // would come from API
        transactions: [],     // would come from API
        notifications: [],    // would come from NotificationContext
        settings: {
          theme: 'system',
          notifications: true,
        },
      };

      // Serialize to JSON and trigger browser download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `creditra-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportState('success');

      // Reset to idle after 4 seconds
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        if (isMountedRef.current) {
          setExportState('idle');
        }
      }, 4000);
    } catch (error) {
      if (!isMountedRef.current) return;
      setExportState('error');
    }
  }, []);

  const handleRetry = useCallback(() => {
    handleExport();
  }, [handleExport]);

  return (
    <main className="data-privacy-page" aria-labelledby="data-privacy-title">
      <h1 id="data-privacy-title" className="data-privacy-page__title">
        Data &amp; Privacy
      </h1>

      {/* Export section */}
      <section
        aria-labelledby="export-section-title"
        className="data-privacy-page__section"
      >
        <h2 id="export-section-title" className="data-privacy-page__section-title">
          Export Your Data
        </h2>
        <p className="data-privacy-page__section-description">
          Download a copy of your Creditra data including your credit lines,
          transactions, and settings.
        </p>

        {/* aria-live region for state announcements */}
        <div
          className="data-privacy-page__status-region"
          aria-live="polite"
          aria-atomic="true"
        >
          {exportState === 'success' && (
            <p
              role="status"
              className="data-privacy-page__status-message data-privacy-page__status-message--success"
            >
              ✓ Export ready — your file has been downloaded.
            </p>
          )}
          {exportState === 'error' && (
            <p
              role="alert"
              className="data-privacy-page__status-message data-privacy-page__status-message--error"
            >
              Export failed. Please try again.
            </p>
          )}
        </div>

        {/* Export button */}
        <div className="data-privacy-page__button-wrapper">
          <button
            className="data-privacy-page__export-button"
            onClick={exportState === 'error' ? handleRetry : handleExport}
            disabled={exportState === 'loading'}
            aria-busy={exportState === 'loading'}
            aria-label={
              exportState === 'loading'
                ? 'Preparing export, please wait'
                : exportState === 'error'
                  ? 'Retry data export'
                  : 'Export my data as JSON'
            }
          >
            {exportState === 'loading' ? (
              <>
                <span
                  className="data-privacy-page__spinner"
                  aria-label="Preparing export"
                  aria-hidden="true"
                />
                <span>Preparing export…</span>
              </>
            ) : exportState === 'error' ? (
              <>
                <span aria-hidden="true">⚠</span>
                <span>Try again</span>
              </>
            ) : (
              <>
                <Download size={18} aria-hidden="true" />
                <span>Export My Data</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Data retention info section */}
      <section
        aria-labelledby="retention-title"
        className="data-privacy-page__section"
      >
        <h2 id="retention-title" className="data-privacy-page__section-title">
          Data Retention
        </h2>
        <p className="data-privacy-page__section-description">
          Your data is retained for the duration of your account and for 90 days
          after deletion as required by financial regulations.
        </p>
      </section>

      {/* Privacy & compliance info section */}
      <section
        aria-labelledby="privacy-title"
        className="data-privacy-page__section"
      >
        <h2 id="privacy-title" className="data-privacy-page__section-title">
          Privacy &amp; Security
        </h2>
        <p className="data-privacy-page__section-description">
          Your personal and financial information is encrypted in transit and at
          rest. We comply with industry-standard security practices and financial
          data protection regulations.
        </p>
      </section>
    </main>
  );
}
