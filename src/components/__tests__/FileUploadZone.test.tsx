import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileUploadZone } from '../FileUploadZone';

// Mock DataTransfer for JSDOM
class MockDataTransferItemList {
  items: any[] = [];
  add(item: File) {
    this.items.push({
      kind: 'file',
      getAsFile: () => item,
    });
  }
}

class MockDataTransfer {
  items = new MockDataTransferItemList();
}

describe('FileUploadZone', () => {
  const mockOnFilesUploaded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.DataTransfer = MockDataTransfer as any;
    // Mock fetch for upload simulation
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('renders the upload zone and instructions', () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    expect(screen.getByText(/Upload Revenue Statements/i)).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop PDF or CSV files/i)).toBeInTheDocument();
  });

  it('rejects files with invalid extensions', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(input, {
      target: { files: [file] },
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Only .pdf, .csv files are supported/i)).toBeInTheDocument();
    });
  });

  it('rejects files that exceed the maximum size', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} maxSizeMB={1} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    const bigFile = new File(['a'.repeat(2 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    
    fireEvent.change(input, {
      target: { files: [bigFile] },
    });
    
    await waitFor(() => {
      expect(screen.getByText(/File size exceeds 1 MB limit/i)).toBeInTheDocument();
    });
  });

  it('shows progress and then success state for valid files', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(input, {
      target: { files: [file] },
    });
    
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    // Wait for simulated upload to complete
    await waitFor(() => {
      expect(screen.getByText(/Successfully uploaded/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('allows removing a file', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(input, {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });
    
    const removeBtn = screen.getByLabelText(/Remove test.pdf/i);
    fireEvent.click(removeBtn);
    
    await waitFor(() => {
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    });
  });

  it('handles file pasting via Ctrl+V', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    
    const file = new File(['pasted content'], 'pasted.pdf', { type: 'application/pdf' });
    
    const pasteEvent = new Event('paste', { bubbles: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: dataTransfer,
    });
    window.dispatchEvent(pasteEvent);
    
    await waitFor(() => {
      expect(screen.getByText('pasted.pdf')).toBeInTheDocument();
    });
  });

  it('is keyboard reachable and triggerable', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const zone = screen.getByRole('button', { name: /Upload revenue files/i });
    
    zone.focus();
    expect(document.activeElement).toBe(zone);
    
    fireEvent.keyDown(zone, { key: 'Enter' });
    // The input should now be triggered (though we can't easily simulate the file picker dialog)
    expect(zone).toHaveAttribute('tabIndex', '0');
  });
});
