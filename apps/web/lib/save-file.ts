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
  /** Use JWT Authorization header (logged-in dashboard re-downloads). */
  auth?: boolean;
  /** Per-job access token for guest downloads (never put JWT in URLs). */
  downloadToken?: string | null;
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
  return name.replace(/[/\\?%*:|"<>|\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim() || 'download';
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

function appendDownloadToken(url: string, downloadToken?: string | null): string {
  if (!downloadToken) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}download_token=${encodeURIComponent(downloadToken)}`;
}

function buildDownloadAuthHeaders(
  auth: boolean,
  downloadToken?: string | null,
): Record<string, string> {
  const headers = buildAuthHeaders(auth);
  if (downloadToken) {
    headers['X-Download-Token'] = downloadToken;
  }
  return headers;
}

function resolveSaveFilename(name: string, fallbackId: string): string {
  const trimmed = name.trim();
  if (
    !trimmed ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'Loading video info…'
  ) {
    return `download-${fallbackId}`;
  }
  return trimmed;
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

/** In the browser, use same-origin proxy for auth; direct API URL for guest file handoff. */
function resolveBrowserDownloadUrl(
  path: string,
  downloadUrl: string | null | undefined,
  auth: boolean,
  downloadToken?: string | null,
): string {
  if (typeof window === 'undefined') {
    return resolveDirectDownloadUrl(path, downloadUrl);
  }
  const base = auth ? resolveProxiedDownloadUrl(path) : resolveDirectDownloadUrl(path, downloadUrl);
  return appendDownloadToken(base, downloadToken);
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
export function releaseDownloadOnServer(id: string, downloadToken?: string | null): void {
  if (typeof window === 'undefined' || !id) return;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  const qs = downloadToken ? `?download_token=${encodeURIComponent(downloadToken)}` : '';
  const url = `${apiUrl}/downloads/${id}/release${qs}`;
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

async function probeDownloadSize(url: string, headers: Record<string, string> = {}): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, headers });
    if (res.ok) return Number(res.headers.get('content-length') || 0);
  } catch {
    // HEAD may fail — fall through
  } finally {
    clearTimeout(timer);
  }
  return 0;
}

/** Fetch same-origin file and save with exact Unicode filename (Safari ignores download= on URL navigations). */
async function saveViaFetchBlob(
  url: string,
  filename: string,
  headers: Record<string, string> = {},
): Promise<void> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    if (res.ok) {
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      await triggerNativeDownload(objectUrl, filename);
      URL.revokeObjectURL(objectUrl);
      return;
    }
    if (res.status === 404 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      continue;
    }
    const message =
      res.status === 403
        ? 'Access denied. Start a new download from the same URL.'
        : res.status === 404
          ? 'File no longer on server (may have expired). Start a new download from the same URL.'
          : `Could not download file (${res.status})`;
    throw new Error(message);
  }
  throw new Error(`Could not download file (${lastStatus || 'unknown'})`);
}

async function saveFileInBrowser(
  url: string,
  filename: string,
  headers: Record<string, string>,
  knownSizeBytes: number,
): Promise<SaveFileResult> {
  const size =
    knownSizeBytes > 0 ? knownSizeBytes : await probeDownloadSize(url, headers);

  // Blob save keeps Bengali/Unicode titles; URL handoff may use ASCII Content-Disposition only.
  if (size === 0 || size <= LARGE_FILE_BYTES) {
    await saveViaFetchBlob(url, filename, headers);
    return 'saved';
  }

  await triggerNativeDownload(url, filename);
  return 'started';
}

export async function saveCompletedFile(
  path: string,
  fallbackFilename: string,
  options: SaveFileOptions = {},
): Promise<SaveFileResult> {
  const {
    downloadUrl,
    fileExtension = '.mp4',
    forceExtension = false,
    auth = false,
    downloadToken,
    fileSizeBytes,
  } = options;

  // Browser: fetch+blob for correct Unicode filenames; URL handoff only for very large files.
  if (typeof window !== 'undefined') {
    const idMatch = path.match(/\/downloads\/([^/?]+)\/file/);
    const fallbackId = idMatch?.[1] ?? 'file';
    const filename = ensureFileExtension(
      sanitizeFilename(resolveSaveFilename(fallbackFilename, fallbackId)),
      fileExtension,
      forceExtension,
    );
    const authHeaders = buildDownloadAuthHeaders(auth, downloadToken);
    const url = appendDownloadToken(resolveProxiedDownloadUrl(path), downloadToken);
    const knownSize =
      typeof fileSizeBytes === 'string'
        ? Number.parseInt(fileSizeBytes, 10)
        : fileSizeBytes ?? 0;

    return saveFileInBrowser(url, filename, authHeaders, knownSize);
  }

  const authHeaders = buildAuthHeaders(auth);
  const downloadUrlResolved = resolveBrowserDownloadUrl(path, downloadUrl, auth, downloadToken);
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
