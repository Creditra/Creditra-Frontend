const UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const rawIndex = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.min(Math.max(rawIndex, 0), UNITS.length - 1);

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${UNITS[i]}`;
}
