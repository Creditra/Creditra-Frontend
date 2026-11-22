import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FormMessage } from './FormMessage';
import { offlineMutation } from '../utils/offline';
import { useOnline } from '../hooks/useOnline';
import './FileUploadZone.css';

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  abortController?: AbortController;
}

interface FileUploadZoneProps {
  onFilesUploaded: (files: File[]) => void;
  acceptedTypes?: string[]; // e.g., ['.pdf', '.csv']
  maxSizeMB?: number;
}

export function FileUploadZone({
  onFilesUploaded,
  acceptedTypes = ['.pdf', '.csv'],
  maxSizeMB = 10,
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const { queueAction } = useOnline();

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
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const uploadFile = async (item: FileUploadItem) => {
    const controller = new AbortController();
    updateItem(item.id, { status: 'uploading', abortController: controller });

    try {
      // Simulate progress since we don't have a real endpoint
      // In a real scenario, we would use XMLHttpRequest to track actual upload progress
      for (let i = 0; i <= 100; i += 25) {
        if (controller.signal.aborted) throw new Error('Upload cancelled');
        await new Promise(resolve => setTimeout(resolve, 400));
        updateItem(item.id, { progress: i });
      }

      // Guard the actual mutation. Previously a fake `.catch(() => ({ ok: true }))`
      // fabricated success on any failure; now the upload never claims to have
      // succeeded when no confirmation was received.
      await offlineMutation({
        fn: async () => {
          const formData = new FormData();
          formData.append('file', item.file);

          const response = await fetch('/api/mock-upload', {
            method: 'POST',
            body: formData,
            signal: controller.signal,
          });

          if (controller.signal.aborted) throw new Error('Upload cancelled');
          if (!response.ok) throw new Error('Upload failed');
        },
        onOffline: () => {
          queueAction(() => {
            uploadFile(item);
          }, `upload-${item.id}`);
        },
        offlineMessage:
          'You are offline. Upload queued and will retry when you reconnect.',
      });

      updateItem(item.id, { status: 'success', progress: 100 });
    } catch (e: any) {
      updateItem(item.id, { status: 'error', errorMessage: e.message || 'Upload failed' });
    }
  };

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    console.log('Handling files:', newFiles);
    const allItems: FileUploadItem[] = [];
    const itemsToUpload: FileUploadItem[] = [];

    Array.from(newFiles).forEach(file => {
      const error = validateFile(file);
      const id = Math.random().toString(36).substring(7);
      
      if (error) {
        allItems.push({
          id,
          file,
          progress: 0,
          status: 'error',
          errorMessage: error,
        });
      } else {
        const item = {
          id,
          file,
          progress: 0,
          status: 'queued',
        };
        allItems.push(item);
        itemsToUpload.push(item);
      }
    });

    setFiles(prev => [...prev, ...allItems]);
    
    // Trigger uploads for valid files
    itemsToUpload.forEach(item => uploadFile(item));
  }, []);

  const onPaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        files.push(items[i].getAsFile()!);
      }
    }
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  useEffect(() => {
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onPaste]);

  const removeFile = (id: string) => {
    const item = files.find(f => f.id === id);
    if (item?.abortController) item.abortController.abort();
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const retryFile = (item: FileUploadItem) => {
    updateItem(item.id, { status: 'queued', progress: 0, errorMessage: undefined });
    uploadFile(item);
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
        onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
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
          onChange={e => e.target.files && handleFiles(e.target.files)}
          aria-label="Upload revenue files"
        />
      </div>

      <div className="file-list" role="list">
        {files.map(item => (
          <div key={item.id} className="file-item" role="listitem">
            <div className="file-item-info">
              <div className="file-item-name">{item.file.name}</div>
              <div className="file-item-meta">{formatSize(item.file.size)}</div>
              
              {item.status === 'uploading' && (
                <div className="file-progress-container">
                  <div 
                    className="file-progress-bar" 
                    style={{ width: `${item.progress}%` }} 
                  />
                </div>
              )}

              {item.status === 'error' && (
                <div className="file-item-status status--error" role="alert">
                  {item.errorMessage}
                </div>
              )}
              {item.status === 'success' && (
                <div className="file-item-status status--success">
                  Successfully uploaded
                </div>
              )}
            </div>
            
            <div className="file-item-actions">
              {item.status === 'error' && (
                <button 
                  className="file-action-btn" 
                  onClick={() => retryFile(item)}
                  title="Retry upload"
                  aria-label={`Retry upload for ${item.file.name}`}
                >
                  🔄
                </button>
              )}
              <button 
                className="file-action-btn file-action-btn--danger" 
                onClick={() => removeFile(item.id)}
                title="Remove file"
                aria-label={`Remove ${item.file.name}`}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Live region for progress announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {files.map(f => f.status === 'uploading' && 
          `Uploading ${f.file.name}: ${f.progress}%`
        ).join(', ')}
      </div>
    </div>
  );
}
