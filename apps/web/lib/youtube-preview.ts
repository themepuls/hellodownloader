/** Instant YouTube preview while yt-dlp metadata is still loading. */
export function extractYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1).split('/')[0] || null;
    }
    const v = parsed.searchParams.get('v');
    if (v) return v;
  } catch {
    // fall through
  }
  const match = trimmed.match(/(?:v=|\/vi\/|youtu\.be\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

export function getOptimisticYouTubePreview(url: string): Record<string, unknown> | null {
  const id = extractYouTubeVideoId(url);
  if (!id) return null;
  return {
    id,
    title: 'Loading video info…',
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: 0,
    uploader: '…',
    formats: [],
    _optimistic: true,
  };
}
