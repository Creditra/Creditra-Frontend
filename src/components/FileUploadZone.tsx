import React, { useState, useRef, useEffect, useCallback } from 'react';
import { offlineMutation, queueOfflineAction } from '../utils/offline';
import './FileUploadZone.css';

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  xhr?: XMLHttpRequest;
}

interface FileUploadZoneProps {
  onFilesUploaded: (files: File[]) => void;
  acceptedTypes?: string[]; // e.g., ['.pdf', '.csv']
  maxSizeMB?: number;
}

let fallbackFileIdCounter = 0;

const createFileUploadId = (): string => {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Fall through to the collision-safe counter fallback.
  }

  fallbackFileIdCounter += 1;
  return `file-fallback-${fallbackFileIdCounter}`;
};

export function FileUploadZone({
  onFilesUploaded: _onFilesUploaded,
  acceptedTypes = ['.pdf', '.csv'],
  maxSizeMB = 10,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const uploadQueueRef = useRef<FileUploadItem[]>([]);
  const activeUploadsRef = useRef(0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!acceptedTypes.includes(extension || '')) {
      return `Only ${acceptedTypes.join(', ')} files are supported.`;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `File size exceeds ${maxSizeMB} MB limit.`;
    }
    return null;
  };

  const updateItem = (id: string, updates: Partial<FileUploadItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const finishUpload = () => {
    activeUploadsRef.current = Math.max(0, activeUploadsRef.current - 1);
    drainUploadQueue();
  };

  const startUpload = (item: FileUploadItem) => {
    activeUploadsRef.current += 1;
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', item.file);

    xhr.open('POST', '/api/mock-upload', true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        updateItem(item.id, {
          progress: Math.round((event.loaded * 100) / event.total),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateItem(item.id, { status: 'success', progress: 100, xhr: undefined });
        onFilesUploaded([item.file]);
      } else {
        updateItem(item.id, { status: 'error', errorMessage: 'Upload failed', xhr: undefined });
      }
      finishUpload();
    };

    xhr.onerror = () => {
      updateItem(item.id, { status: 'error', errorMessage: 'Upload failed', xhr: undefined });
      finishUpload();
    };

    xhr.onabort = () => {
      updateItem(item.id, { status: 'error', errorMessage: 'Upload cancelled', xhr: undefined });
      finishUpload();
    };
          queueOfflineAction({
            type: 'upload',
            label: `Upload ${item.file.name}`,
            description: `${formatSize(item.file.size)} · ${item.file.name.split('.').pop()?.toUpperCase() ?? 'file'}`,
            dedupeKey: `upload-${item.id}`,
            run: () => uploadFile(item),
          });

    updateItem(item.id, { status: 'uploading', xhr });
    try {
      xhr.send(formData);
    } catch {
      updateItem(item.id, { status: 'error', errorMessage: 'Upload failed', xhr: undefined });
      finishUpload();
    }
  };

  const enqueueUpload = (item: FileUploadItem, reconnecting = false) => {
    if (!reconnecting && typeof navigator !== 'undefined' && !navigator.onLine) {
      updateItem(item.id, { status: 'queued', progress: 0, errorMessage: undefined });
      queueAction(() => enqueueUpload(item, true), `upload-${item.id}`);
      return;
    }

    uploadQueueRef.current.push(item);
    drainUploadQueue();
  };

  const drainUploadQueue = () => {
    while (activeUploadsRef.current < 3 && uploadQueueRef.current.length > 0) {
      const item = uploadQueueRef.current.shift();
      if (item) startUpload(item);
    }
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const allItems: FileUploadItem[] = [];
    const itemsToUpload: FileUploadItem[] = [];

    Array.from(newFiles).forEach((file) => {
      const error = validateFile(file);
      const id = createFileUploadId();

      if (error) {
        allItems.push({
          id,
          file,
          progress: 0,
          status: 'error',
          errorMessage: error,
        });
      } else {
        const item: FileUploadItem = {
          id,
          file,
          progress: 0,
          status: 'queued',
        };
        allItems.push(item);
        itemsToUpload.push(item);
      }
    });

    setFiles((prev) => [...prev, ...allItems]);

    // Trigger uploads for valid files
    itemsToUpload.forEach((item) => enqueueUpload(item));
  }, []);

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          files.push(items[i].getAsFile()!);
        }
      }
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles],
  );

  useEffect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onPaste]);

  const removeFile = (id: string) => {
    const item = files.find((f) => f.id === id);
    if (item?.xhr) item.xhr.abort();
    uploadQueueRef.current = uploadQueueRef.current.filter((queued) => queued.id !== id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const retryFile = (item: FileUploadItem) => {
    updateItem(item.id, { status: 'queued', progress: 0, errorMessage: undefined });
    enqueueUpload(item);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        ref={zoneRef}
        className={`file-upload-zone ${isDragging ? 'file-upload-zone--drag-over' : ''}`}
        role="button"
        tabIndex={0}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        aria-label="Upload revenue files. Drag and drop files here or click to browse."
      >
        <span className="file-upload-zone-title">Upload Revenue Statements</span>
        <span className="file-upload-zone-subtitle">Drag & drop PDF or CSV files (Max 10MB)</span>
        <input
          ref={fileInputRef}
          id="file-upload-input"
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.csv"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          aria-label="Upload revenue files"
        />
      </div>

      <div className="file-list" role="list">
        {files.map((item) => (
          <div key={item.id} id={item.id} className="file-item" role="listitem">
            <div className="file-item-info">
              <div className="file-item-name">{item.file.name}</div>
              <div className="file-item-meta">{formatSize(item.file.size)}</div>

              {item.status === 'uploading' && (
                <div className="file-progress-container">
                  <div className="file-progress-bar" style={{ width: `${item.progress}%` }} />
                </div>
              )}

              {item.status === 'error' && (
                <div className="file-item-status status--error" role="alert">
                  {item.errorMessage}
                </div>
              )}
              {item.status === 'success' && (
                <div className="file-item-status status--success">Successfully uploaded</div>
              )}
            </div>

            <div className="file-item-actions">
              {item.status === 'error' && (
                <button
                  className="file-action-btn"
                  onClick={() => retryFile(item)}
                  title="Retry upload"
                  aria-label={`Retry upload for ${item.file.name}`}
                  aria-controls={item.id}
                >
                  🔄
                </button>
              )}
              <button
                className="file-action-btn file-action-btn--danger"
                onClick={() => removeFile(item.id)}
                title="Remove file"
                aria-label={`Remove ${item.file.name}`}
                aria-controls={item.id}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Live region for progress announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {files
          .map((f) => f.status === 'uploading' && `Uploading ${f.file.name}: ${f.progress}%`)
          .join(', ')}
      </div>
    </div>
  );
}
