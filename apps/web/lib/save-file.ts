/** Files above this size use the browser download manager (never load into RAM). */
const LARGE_FILE_BYTES = 100 * 1024 * 1024;

export type SaveFileResult = 'saved' | 'started';

export interface SaveFileOptions {
  /** Server-provided direct URL (bypasses Next.js proxy). */
  downloadUrl?: string | null;
  /** Known size in bytes — avoids a HEAD request. */
  fileSizeBytes?: number | string | null;
  /** File extension when title lacks one (e.g. ".mp4"). */
  fileExtension?: string;
  /** When true, always apply fileExtension even if filename already has one. */
  forceExtension?: boolean;
  auth?: boolean;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('accessToken') ??
    (() => {
      try {
        const raw = localStorage.getItem('hellodownloader-user');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
        return parsed.state?.accessToken ?? null;
      } catch {
        return null;
      }
    })()
  );
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const quotedMatch = header.match(/filename="([^"]+)"/i);
  return quotedMatch?.[1] ?? null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'download';
}

function ensureFileExtension(filename: string, ext: string, force = false): string {
  const normalized = ext.startsWith('.') ? ext : `.${ext}`;
  const lower = filename.toLowerCase();
  if (!force && /\.(mp4|mp3|m4a|webm|vtt|srt|zip)$/i.test(lower)) {
    return filename;
  }
  const withoutExt = filename.replace(/\.[^.]+$/, '') || filename;
  return `${withoutExt}${normalized}`;
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

async function resolveDownloadFilename(
  url: string,
  fallbackFilename: string,
  ext: string,
  forceExtension = false,
  authHeaders: Record<string, string> = {},
): Promise<string> {
  if (forceExtension) {
    return ensureFileExtension(sanitizeFilename(fallbackFilename), ext, true);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, headers: authHeaders });
    const fromHeader = parseFilenameFromDisposition(res.headers.get('Content-Disposition'));
    if (fromHeader) return ensureFileExtension(sanitizeFilename(fromHeader), ext);
  } catch {
    // fall through
  } finally {
    clearTimeout(timer);
  }
  return ensureFileExtension(sanitizeFilename(fallbackFilename), ext);
}

function appendAccessToken(url: string, auth: boolean): string {
  if (!auth) return url;
  const token = getAccessToken();
  if (!token) {
    throw new Error('Please log in again to download this file.');
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}access_token=${encodeURIComponent(token)}`;
}
function buildAuthHeaders(auth: boolean): Record<string, string> {
  if (!auth) return {};
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Same-origin proxy URL — required so authenticated fetches can send Authorization. */
function resolveProxiedDownloadUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalized.startsWith('/api/v1') ? normalized : `/api/v1${normalized}`;
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${apiPath}`;
  }
  return apiPath;
}

/** Pick download URL: authenticated routes use the Next.js proxy; public files may use direct API. */
function resolveDownloadUrl(
  path: string,
  downloadUrl: string | null | undefined,
  auth: boolean,
): string {
  if (auth) return resolveProxiedDownloadUrl(path);
  return resolveDirectDownloadUrl(path, downloadUrl);
}

/** Match page hostname (localhost vs 127.0.0.1) so CORS stays consistent. */
function normalizeDownloadHost(url: string): string {
  if (typeof window === 'undefined') return url;
  try {
    const parsed = new URL(url);
    parsed.hostname = window.location.hostname;
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Resolve a direct API URL for file delivery (never the Next.js proxy). */
export function resolveDirectDownloadUrl(path: string, downloadUrl?: string | null): string {
  if (downloadUrl?.startsWith('http')) return normalizeDownloadHost(downloadUrl);

  const normalized = path.startsWith('/') ? path : `/${path}`;
  const apiPath = normalized.startsWith('/api/v1') ? normalized : `/api/v1${normalized}`;

  const configured = process.env.NEXT_PUBLIC_API_DIRECT_URL?.replace(/\/$/, '');
  if (configured) {
    return normalizeDownloadHost(`${configured}${apiPath.replace(/^\/api\/v1/, '') || apiPath}`);
  }

  const publicApi = process.env.NEXT_PUBLIC_API_URL;
  if (publicApi?.startsWith('http')) {
    return normalizeDownloadHost(
      `${publicApi.replace(/\/$/, '')}${apiPath.replace(/^\/api\/v1/, '') || apiPath}`,
    );
  }

  if (typeof window !== 'undefined') {
    const port = process.env.NEXT_PUBLIC_API_PORT ?? '4001';
    return `${window.location.protocol}//${window.location.hostname}:${port}${apiPath}`;
  }

  return `http://127.0.0.1:4001${apiPath}`;
}

async function probeFileSize(url: string, authHeaders: Record<string, string> = {}): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, headers: authHeaders });
    if (res.ok) return Number(res.headers.get('content-length') || 0);
  } catch {
    // HEAD may fail — fall through
  } finally {
    clearTimeout(timer);
  }
  return 0;
}

/** Ask server to remove a completed download file (refresh, new URL, tab close). */
export function releaseDownloadOnServer(id: string): void {
  if (typeof window === 'undefined' || !id) return;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  const url = `${apiUrl}/downloads/${id}/release`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, '');
      return;
    }
    void fetch(url, { method: 'POST', keepalive: true });
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Hand off to the browser download manager — returns immediately.
 * Do NOT delete the server file until the browser finishes (handled by retention policy).
 */
async function triggerNativeDownload(url: string, filename: string): Promise<void> {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function saveCompletedFile(
  path: string,
  fallbackFilename: string,
  options: SaveFileOptions = {},
): Promise<SaveFileResult> {
  const { downloadUrl, fileSizeBytes, fileExtension = '.mp4', forceExtension = false, auth = false } =
    options;

  // Authenticated files (playlists): stream via browser download manager with a token in the URL.
  // Loading large ZIPs into memory via fetch would hang or crash the tab.
  if (auth) {
    const url = appendAccessToken(resolveDownloadUrl(path, downloadUrl, true), true);
    const filename = ensureFileExtension(
      sanitizeFilename(fallbackFilename),
      fileExtension,
      forceExtension,
    );
    await triggerNativeDownload(url, filename);
    return 'started';
  }

  const authHeaders = buildAuthHeaders(auth);
  const downloadUrlResolved = resolveDownloadUrl(path, downloadUrl, auth);
  const knownSize =
    typeof fileSizeBytes === 'string'
      ? Number.parseInt(fileSizeBytes, 10)
      : fileSizeBytes ?? 0;
  const size =
    knownSize > 0 ? knownSize : await probeFileSize(downloadUrlResolved, authHeaders);
  const filename = await resolveDownloadFilename(
    downloadUrlResolved,
    fallbackFilename,
    fileExtension,
    forceExtension,
    authHeaders,
  );

  // Public large files: hand off to browser download manager (no auth headers possible).
  if (size === 0 || size > LARGE_FILE_BYTES) {
    await triggerNativeDownload(downloadUrlResolved, filename);
    return 'started';
  }

  const res = await fetch(downloadUrlResolved, { headers: authHeaders });

  if (!res.ok) {
    const message =
      res.status === 401
        ? 'Please log in again to download this file.'
        : res.status === 404
          ? 'File no longer on server (may have expired). Start a new download from the same URL.'
          : `Could not download file (${res.status})`;
    throw new Error(message);
  }

  const mimeType =
    res.headers.get('Content-Type') ??
    (fileExtension === '.mp3'
      ? 'audio/mpeg'
      : fileExtension === '.zip'
        ? 'application/zip'
        : 'application/octet-stream');
  const buffer = await res.arrayBuffer();
  const blob = new Blob([buffer], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return 'saved';
}
