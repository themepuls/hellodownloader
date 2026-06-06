const PROXY_HOST_PATTERN =
  /instagram|cdninstagram|fbcdn|facebook|tiktok|twimg|twitter/i;

export function needsThumbnailProxy(thumbnailUrl: string): boolean {
  try {
    return PROXY_HOST_PATTERN.test(new URL(thumbnailUrl).hostname);
  } catch {
    return false;
  }
}

export function getThumbnailSrc(thumbnailUrl: string): string {
  if (!thumbnailUrl) return '';
  if (needsThumbnailProxy(thumbnailUrl)) {
    return `/api/v1/downloads/thumbnail-proxy?url=${encodeURIComponent(thumbnailUrl)}`;
  }
  return thumbnailUrl;
}

export function thumbnailExportUrl(id: string): string {
  const base =
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1')
      : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');
  return `${base}/thumbnails/${id}/file`;
}
