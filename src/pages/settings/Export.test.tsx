import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ExportAccountSettings, type ExportAccountData } from './Export';

describe('ExportAccountSettings', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let createdBlobs: Blob[];

  beforeEach(() => {
    createdBlobs = [];
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          createdBlobs.push(blob);
        }
        return 'blob:mock-url';
      });
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('exports account data as JSON', async () => {
    render(<ExportAccountSettings />);

    fireEvent.click(screen.getByTestId('export-json-button'));

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('application/json');

    const text = await createdBlobs[0].text();
    const parsed = JSON.parse(text) as ExportAccountData;
    expect(parsed.profile.username).toBe('user_export');
    expect(parsed.activities).toHaveLength(2);
  });

  it('exports account data as CSV using downloadCsv', async () => {
    render(<ExportAccountSettings />);

    fireEvent.click(screen.getByTestId('export-csv-button'));

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('text/csv;charset=utf-8');

    const text = await createdBlobs[0].text();
    expect(text).toContain('Section,Key/ID,Detail/Action,Timestamp\r\n');
    expect(text).toContain('Profile,Username,user_export,2026-01-01');
    expect(text).toContain('Activity,1,Credit Score Requested,2026-06-20');
  });

  it('escapes quotes, commas, newlines and neutralizes formula-leading cells in CSV', async () => {
    const customData: ExportAccountData = {
      profile: {
        username: 'He said "hi", next\nline',
        email: 'user@creditra.io',
        jointAt: '2026-01-01',
      },
      activities: [
        { id: 1, action: '=SUM(A1:A2)', timestamp: '2026-06-20' },
      ],
    };

    render(<ExportAccountSettings getExportData={() => customData} />);

    fireEvent.click(screen.getByTestId('export-csv-button'));

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    const text = await createdBlobs[0].text();
    expect(text).toContain('"He said ""hi"", next\nline"');
    expect(text).toContain("Activity,1,'=SUM(A1:A2),2026-06-20");
  });

  it('shows error alert, logs narrowed message, and re-enables buttons when URL.createObjectURL throws', async () => {
    createObjectURLSpy.mockImplementation(() => {
      throw new Error('Blob creation failed');
    });

    render(<ExportAccountSettings />);

    const jsonButton = screen.getByTestId('export-json-button') as HTMLButtonElement;
    const csvButton = screen.getByTestId('export-csv-button') as HTMLButtonElement;

    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe(
        'Failed to bundle your account archive. Please try again later.',
      );
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to export account data:',
      'Blob creation failed',
    );
    expect(jsonButton.disabled).toBe(false);
    expect(csvButton.disabled).toBe(false);
  });

  it('keeps buttons disabled while exporting and re-enables them once complete', async () => {
    let resolveExport!: (data: ExportAccountData) => void;
    const pendingExport = new Promise<ExportAccountData>((resolve) => {
      resolveExport = resolve;
    });

    render(<ExportAccountSettings getExportData={() => pendingExport} />);

    const jsonButton = screen.getByTestId('export-json-button') as HTMLButtonElement;
    const csvButton = screen.getByTestId('export-csv-button') as HTMLButtonElement;

    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(jsonButton.disabled).toBe(true);
      expect(csvButton.disabled).toBe(true);
    });

    resolveExport({
      profile: { username: 'alice', email: 'alice@creditra.io', jointAt: '2026-01-01' },
      activities: [],
    });

    await waitFor(() => {
      expect(jsonButton.disabled).toBe(false);
      expect(csvButton.disabled).toBe(false);
    });
  });
});
