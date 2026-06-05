export interface VideoFormat {
  format_id: string;
  ext: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
}

export interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: VideoFormat[];
}

export interface QualityOption {
  height: number;
  fps?: number;
  label: string;
  badge: string;
  ext: string;
  filesize?: number;
  formatId: string;
}

function formatBytes(f: VideoFormat): number {
  return f.filesize ?? f.filesize_approx ?? 0;
}

/** Standard resolution label — uses the shorter edge for vertical/square video. */
export function effectiveResolution(f: VideoFormat): number {
  if (f.width && f.height) return Math.min(f.width, f.height);
  return f.height ?? f.width ?? 0;
}

function hasVideo(f: VideoFormat): boolean {
  const res = effectiveResolution(f);
  return Boolean(res >= 144 && f.vcodec && f.vcodec !== 'none');
}

function hasAudio(f: VideoFormat): boolean {
  return Boolean(f.acodec && f.acodec !== 'none');
}

function isCombined(f: VideoFormat): boolean {
  return hasVideo(f) && hasAudio(f);
}

function qualityBadge(resolution: number): string {
  if (resolution >= 2160) return '4K';
  if (resolution >= 1440) return 'QHD';
  if (resolution >= 1080) return 'FHD';
  if (resolution >= 720) return 'HD';
  if (resolution >= 480) return 'SD';
  return 'Low';
}

function qualityLabel(resolution: number, fps?: number): string {
  if (fps && fps >= 50) return `${resolution}p${Math.round(fps)}`;
  return `${resolution}p`;
}

function groupKey(f: VideoFormat): string {
  const fps = f.fps ? Math.round(f.fps) : 0;
  return `${effectiveResolution(f)}-${fps}`;
}

function preferFormat(a: VideoFormat, b: VideoFormat): VideoFormat {
  const score = (f: VideoFormat) => {
    let s = formatBytes(f);
    if (f.ext === 'mp4') s += 1_000_000_000;
    if (isCombined(f)) s += 500_000_000;
    return s;
  };
  return score(a) >= score(b) ? a : b;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * Build quality options from yt-dlp formats.
 * Uses the shorter video edge so vertical reels (e.g. 1080×1920) show as 1080p, not 1920p.
 */
export function getVideoQualityOptions(
  formats: VideoFormat[],
  maxHeight = 4320,
  duration = 0,
): QualityOption[] {
  const videoFormats = formats.filter(hasVideo);

  const audioFormats = formats.filter(
    (f) => hasAudio(f) && (!f.vcodec || f.vcodec === 'none'),
  );
  const bestAudioBytes = audioFormats.reduce(
    (max, f) => Math.max(max, formatBytes(f)),
    0,
  );

  const groups = new Map<string, VideoFormat[]>();
  for (const f of videoFormats) {
    const resolution = effectiveResolution(f);
    if (!resolution || resolution > maxHeight) continue;
    const key = groupKey(f);
    const list = groups.get(key) ?? [];
    list.push(f);
    groups.set(key, list);
  }

  const options: QualityOption[] = [];

  for (const [, group] of groups) {
    let best = group[0];
    for (const f of group.slice(1)) {
      best = preferFormat(best, f);
    }

    const resolution = effectiveResolution(best);
    const fps = best.fps ? Math.round(best.fps) : undefined;

    let filesize = formatBytes(best);
    if (!isCombined(best) && bestAudioBytes > 0) {
      filesize = filesize > 0 ? filesize + bestAudioBytes : bestAudioBytes;
    }

    options.push({
      height: resolution,
      fps,
      label: qualityLabel(resolution, fps),
      badge: qualityBadge(resolution),
      ext: 'MP4',
      filesize: filesize || undefined,
      formatId: best.format_id,
    });
  }

  return options.sort((a, b) => {
    if (b.height !== a.height) return b.height - a.height;
    return (b.fps ?? 0) - (a.fps ?? 0);
  });
}

export function getMaxQuality(formats: VideoFormat[]): number {
  const resolutions = formats.filter(hasVideo).map((f) => effectiveResolution(f));
  return resolutions.length ? Math.max(...resolutions) : 0;
}
