/** Characters illegal in file names on Windows/macOS/Linux. */
const INVALID_FILENAME_CHARS = /[/\\?%*:|"<>|\x00-\x1f]/g;

export function sanitizeDownloadFilename(title: string, maxLength = 120): string {
  const cleaned = title.replace(INVALID_FILENAME_CHARS, '_').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'download';
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
}

export function extensionForDownloadType(type?: string | null): string {
  switch (type) {
    case 'MP3':
      return '.mp3';
    case 'SUBTITLE':
      return '.vtt';
    default:
      return '.mp4';
  }
}

export function buildDownloadFilename(
  title: string | null | undefined,
  type: string | undefined,
  downloadId: string,
): string {
  const ext = extensionForDownloadType(type);
  const base = sanitizeDownloadFilename(title?.trim() || `download-${downloadId}`);
  const lower = base.toLowerCase();
  if (lower.endsWith(ext)) return base;
  if (/\.(mp4|mp3|m4a|webm|vtt|srt|zip)$/i.test(lower)) return base;
  return `${base}${ext}`;
}

/** ASCII-only fallback for legacy clients; prefer filename*=UTF-8. */
export function asciiFilenameFallback(filename: string): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.mp4';
  return `download${ext.toLowerCase()}`;
}

export function contentDispositionAttachment(filename: string): string {
  const ascii = asciiFilenameFallback(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
