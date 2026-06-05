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
