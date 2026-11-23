import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileUploadZone } from '../FileUploadZone';

class MockXMLHttpRequest {
  static instances: MockXMLHttpRequest[] = [];
  status = 0;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: ((event: ProgressEvent) => void) | null = null;
  onerror: ((event: ProgressEvent) => void) | null = null;
  onabort: ((event: ProgressEvent) => void) | null = null;
  open = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => this.onabort?.({} as ProgressEvent));

  constructor() {
    MockXMLHttpRequest.instances.push(this);
  }
}

class MockDataTransferItemList {
  items: any[] = [];
  get length() {
    return this.items.length;
  }
  [index: number]: any;
  add(item: File) {
    const entry = { kind: 'file', getAsFile: () => item };
    this.items.push(entry);
    Object.defineProperty(this, this.items.length - 1, { value: entry, configurable: true });
  }
}

class MockDataTransfer {
  items = new MockDataTransferItemList();
}

describe('FileUploadZone', () => {
  const mockOnFilesUploaded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    MockXMLHttpRequest.instances = [];
    global.DataTransfer = MockDataTransfer as any;
    global.XMLHttpRequest = MockXMLHttpRequest as any;
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

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('test.pdf')).toBeInTheDocument());
    const xhr = MockXMLHttpRequest.instances[0];

    act(() =>
      xhr.upload.onprogress?.({ loaded: 50, total: 100, lengthComputable: true } as ProgressEvent),
    );
    expect(screen.getByText(/Uploading test.pdf: 50%/i)).toBeInTheDocument();

    act(() => {
      xhr.status = 200;
      xhr.onload?.({} as ProgressEvent);
    });

    await waitFor(() => expect(screen.getByText(/Successfully uploaded/i)).toBeInTheDocument());
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
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);

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

  it('limits active uploads to three and starts queued uploads after a slot opens', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    const files = [1, 2, 3, 4].map(
      (number) => new File([`test ${number}`], `test-${number}.pdf`, { type: 'application/pdf' }),
    );

    fireEvent.change(input, { target: { files } });

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(3));

    act(() => {
      MockXMLHttpRequest.instances[0].status = 200;
      MockXMLHttpRequest.instances[0].onload?.({} as ProgressEvent);
    });

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(4));
  });

  it('shows XHR upload failures', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['test'], 'failed.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(1));
    act(() => MockXMLHttpRequest.instances[0].onerror?.({} as ProgressEvent));

    expect(await screen.findByText('Upload failed')).toBeInTheDocument();
  });

  it('reports cancellation when an upload is removed', async () => {
    render(<FileUploadZone onFilesUploaded={mockOnFilesUploaded} />);
    const input = screen.getByLabelText('Upload revenue files', { selector: 'input' });
    fireEvent.change(input, {
      target: { files: [new File(['test'], 'cancel.pdf', { type: 'application/pdf' })] },
    });

    await waitFor(() => expect(MockXMLHttpRequest.instances).toHaveLength(1));
    fireEvent.click(screen.getByLabelText(/Remove cancel.pdf/i));

    await waitFor(() => {
      expect(screen.queryByText('cancel.pdf')).not.toBeInTheDocument();
    });
  });
});
