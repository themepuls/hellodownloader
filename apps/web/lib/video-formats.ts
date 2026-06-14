export interface VideoFormat {
  format_id: string;
  ext: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  vbr?: number;
  abr?: number;
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

/** Estimate size from yt-dlp bitrate fields (kbps) when filesize is missing. */
function estimateBytesFromBitrate(kbps: number | undefined, durationSec: number): number {
  if (!kbps || !durationSec || durationSec <= 0) return 0;
  return Math.round((kbps * 1000 * durationSec) / 8);
}

function streamBitrate(f: VideoFormat): number | undefined {
  return f.vbr ?? f.tbr ?? undefined;
}

function audioBitrate(f: VideoFormat): number | undefined {
  return f.abr ?? f.tbr ?? undefined;
}

function estimateFormatBytes(f: VideoFormat, durationSec: number): number {
  const direct = formatBytes(f);
  if (direct > 0) return direct;
  return estimateBytesFromBitrate(streamBitrate(f), durationSec);
}

function hasKnownSize(f: VideoFormat): boolean {
  return formatBytes(f) > 0;
}

/** HLS/m3u8 combined rows (e.g. YouTube format 91–95) advertise tbr but not real file size. */
function isOpaqueCombined(f: VideoFormat): boolean {
  return isCombined(f) && !hasKnownSize(f);
}

function estimateAudioBytes(formats: VideoFormat[], durationSec: number): number {
  let best = 0;
  for (const f of formats) {
    const direct = formatBytes(f);
    const est =
      direct > 0 ? direct : estimateBytesFromBitrate(audioBitrate(f), durationSec);
    best = Math.max(best, est);
  }
  if (best > 0) return best;
  // yt-dlp merges bestaudio (~128 kbps m4a) when metadata has no separate audio rows.
  return estimateBytesFromBitrate(128, durationSec);
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

function isH264Codec(vcodec?: string): boolean {
  if (!vcodec) return false;
  const v = vcodec.toLowerCase();
  return v.includes('avc1') || v.includes('h264') || v.includes('avc');
}

function preferFormat(a: VideoFormat, b: VideoFormat, durationSec: number): VideoFormat {
  const score = (f: VideoFormat) => {
    const direct = formatBytes(f);
    const est = estimateFormatBytes(f, durationSec);
    let s = est;
    if (f.ext === 'mp4') s += 1_000_000;
    // Prefer progressive combined MP4 — guaranteed audio on desktop players.
    if (isCombined(f)) s += 3_000_000_000;
    if (isCombined(f) && hasKnownSize(f)) s += 500_000_000;
    if (isH264Codec(f.vcodec)) s += 10_000_000;
    // Deprioritize HLS combined rows that only expose tbr (often 2× actual merged size).
    if (isOpaqueCombined(f)) s -= 1_000_000_000;
    if (!est) s -= 2_000_000_000;
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
  const bestAudioBytes = estimateAudioBytes(audioFormats, duration);

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
      best = preferFormat(best, f, duration);
    }

    const resolution = effectiveResolution(best);
    const fps = best.fps ? Math.round(best.fps) : undefined;

    let filesize = estimateFormatBytes(best, duration);
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
      // Always pass format id — server merges audio for DASH video-only streams.
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
