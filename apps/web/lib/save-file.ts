const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1')
    : 'http://localhost:4000/api/v1';

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

async function confirmSaveOnServer(path: string, auth: boolean): Promise<void> {
  const confirmPath = path.replace(/\/file$/, '/confirm-save');
  if (confirmPath === path) return;

  const token = auth ? getAccessToken() : null;
  try {
    await fetch(`${API_URL}${confirmPath}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // Non-fatal: file stays on server until retention cleanup.
  }
}

export async function saveCompletedFile(
  path: string,
  fallbackFilename: string,
  auth = false,
): Promise<void> {
  const token = auth ? getAccessToken() : null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const message =
      res.status === 404
        ? 'File no longer on server (may have expired). Start a new download from the same URL.'
        : `Could not download file (${res.status})`;
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ?? fallbackFilename;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  await confirmSaveOnServer(path, auth);
}
