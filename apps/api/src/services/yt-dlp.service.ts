import { Injectable, Logger } from '@nestjs/common';
import { detectPlatform, isSocialPlatform } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';
import sharp from '../utils/load-sharp';
import * as os from 'os';

export interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  duration: number;
  uploader: string;
  formats: Array<{
    format_id: string;
    ext: string;
    width?: number;
    height?: number;
    filesize?: number;
    filesize_approx?: number;
    tbr?: number;
    vbr?: number;
    abr?: number;
    fps?: number;
    vcodec?: string;
    acodec?: string;
  }>;
}

export interface DownloadOptions {
  format?: string;
  maxHeight?: number;
  audioOnly?: boolean;
  durationSeconds?: number;
  url?: string;
  onProgress?: (percent: number) => void;
  onItemsProgress?: (completed: number, total: number | null) => void;
  isPlaylist?: boolean;
  /** When true, skip H.264 transcode during download — run finishCompatTranscode after COMPLETED. */
  deferCompatTranscode?: boolean;
}

export interface PlaylistDownloadOptions {
  maxHeight?: number;
  onProgress?: (percent: number) => void;
  onItemsProgress?: (completed: number, total: number | null) => void;
}

/** Metadata: default/web first — android client only returns ~5 formats */
const YOUTUBE_METADATA_CLIENTS = [
  'web',
  'mweb,web',
  'ios,tv_embedded,android',
  'android,web',
] as const;

/**
 * YouTube download fallbacks after the default client.
 * Do NOT use android,web or ios,tv_embedded,android — SABR sessions often expose only 360p (format 18).
 */
const YOUTUBE_DOWNLOAD_CLIENTS = ['mweb,web', 'web'] as const;

@Injectable()
export class YtDlpService {
  private readonly logger = new Logger(YtDlpService.name);
  private readonly binary = YtDlpService.resolveBinary();
  private readonly ffmpegPath = YtDlpService.resolveFfmpegPath();
  private readonly monorepoRoot = path.resolve(__dirname, '../../../..');

  private static resolveToolPath(
    envKey: string,
    fallbacks: string[],
  ): string | null {
    const configured = process.env[envKey]?.trim();
    const candidates = [configured, ...fallbacks].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return configured ?? null;
  }

  private static resolveBinary(): string {
    return (
      YtDlpService.resolveToolPath('YT_DLP_PATH', [
        '/opt/homebrew/bin/yt-dlp',
        '/usr/local/bin/yt-dlp',
        `${process.env.HOME ?? ''}/Library/Python/3.9/bin/yt-dlp`,
      ]) ?? 'yt-dlp'
    );
  }

  private static resolveFfmpegPath(): string | null {
    return YtDlpService.resolveToolPath('FFMPEG_PATH', [
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
    ]);
  }

  private static resolveAria2Path(): string | null {
    return YtDlpService.resolveToolPath('ARIA2C_PATH', [
      '/opt/homebrew/bin/aria2c',
      '/usr/local/bin/aria2c',
    ]);
  }

  /** Parallel fragments, buffer tuning, and optional aria2c for direct HTTP (social CDNs). */
  private buildSpeedArgs(url: string): string[] {
    const isYoutube = /youtube\.com|youtu\.be/i.test(url);
    const fragments = process.env.YT_DLP_CONCURRENT_FRAGMENTS?.trim() || (isYoutube ? '32' : '16');

    const args: string[] = [
      '-N',
      fragments,
      '--buffer-size',
      process.env.YT_DLP_BUFFER_SIZE?.trim() || '512K',
      '--resize-buffer',
    ];

    if (isYoutube) {
      args.push('--http-chunk-size', process.env.YT_DLP_HTTP_CHUNK_SIZE?.trim() || '10M');
      this.logger.log(`YouTube: ${fragments} parallel fragments, 10M HTTP chunks`);
    }

    const aria2 = YtDlpService.resolveAria2Path();
    if (aria2 && !isYoutube) {
      const connections = process.env.YT_DLP_ARIA2_CONNECTIONS?.trim() || '16';
      args.push('--downloader', 'https:aria2c');
      args.push('--downloader', 'http:aria2c');
      args.push(
        '--downloader-args',
        `aria2c:-x ${connections} -s ${connections} -k 1M --file-allocation=none --summary-interval=0 --quiet=true`,
      );
      this.logger.log(`Direct HTTP: aria2c (${connections} connections)`);
    }

    return args;
  }

  private globalArgs(): string[] {
    const args: string[] = [];
    if (this.ffmpegPath) {
      args.push('--ffmpeg-location', this.ffmpegPath);
    }
    // Required for YouTube web/mweb clients to resolve n-challenge (EJS)
    args.push('--js-runtimes', 'node');
    return args;
  }

  /** User-facing message from yt-dlp stderr/stdout */
  static parseError(err: unknown): string {
    const stderr =
      (err as { stderr?: string })?.stderr ??
      (err as { message?: string })?.message ??
      String(err);

    if (/429|Too Many Requests/i.test(stderr)) {
      return 'YouTube is rate-limiting requests. Wait a few minutes and try again.';
    }
    if (
      /confirm your age|age.restricted|inappropriate for some users|not a bot|Sign in to confirm/i.test(
        stderr,
      )
    ) {
      return (
        'This video requires YouTube sign-in or is age-restricted. ' +
        'Please try a different public video — no account or password is needed for most videos.'
      );
    }
    if (/Video unavailable|Private video/i.test(stderr)) {
      return 'This video is unavailable or private.';
    }
    if (/login required|not logged in|cookies.+required|private account/i.test(stderr)) {
      if (/instagram/i.test(stderr)) {
        return 'Instagram requires login for this content. Try a public post or Reel.';
      }
      if (/facebook/i.test(stderr)) {
        return 'Facebook requires login for this video. Try a public video or Reel.';
      }
      if (/tiktok/i.test(stderr)) {
        return 'TikTok could not access this video. It may be private or region-locked.';
      }
      return 'This video requires login or is not publicly accessible.';
    }
    if (/Unsupported URL|Unsupported url|No video formats found/i.test(stderr)) {
      return (
        'This link is not supported. Try YouTube, Facebook, Instagram, TikTok, Twitter/X, ' +
        'or other public video URLs.'
      );
    }
    if (/Requested format is not available/i.test(stderr)) {
      if (/facebook/i.test(stderr)) {
        return (
          'Could not download this Facebook video at the selected quality. ' +
          'Try another quality option or use the HD (sd/hd) stream if shown.'
        );
      }
      return 'The selected quality is not available for this video. Try another quality option.';
    }
    if (/timed out|ETIMEDOUT|Timeout/i.test(stderr)) {
      return 'Download timed out. Long videos can take 10–30+ minutes — try a lower quality or try again.';
    }
    if (/ffmpeg|ffprobe.*not found|Postprocessing/i.test(stderr)) {
      return 'ffmpeg is required for MP3/audio conversion. Install: brew install ffmpeg';
    }
    if (/ENOENT|not found/i.test(stderr)) {
      return 'yt-dlp is not installed. Install: brew install yt-dlp ffmpeg';
    }

    const line = stderr.split('\n').find((l) => l.includes('ERROR:')) ?? stderr.slice(0, 280);
    return line.replace(/^ERROR:\s*/i, '').trim() || 'Could not fetch video metadata';
  }

  static parsePlaylistError(err: unknown): string {
    const base = YtDlpService.parseError(err);
    if (base === 'This video is unavailable or private.') {
      return (
        'No videos could be downloaded from this playlist. ' +
        'Items may be private, deleted, age-restricted, or unavailable in your region.'
      );
    }
    return base;
  }

  private listMediaFiles(outputDir: string): string[] {
    if (!fs.existsSync(outputDir)) return [];
    return fs
      .readdirSync(outputDir)
      .filter((f) => !f.startsWith('.') && !f.endsWith('.part') && /\.(mp4|webm|mkv|m4a|mp3)$/i.test(f))
      .map((f) => path.join(outputDir, f));
  }

  private outputDirHasMedia(outputDir: string): boolean {
    return this.listMediaFiles(outputDir).length > 0;
  }

  private buildPlaylistDownloadArgSets(url: string, downloadArgs: string[]): string[][] {
    const sets: string[][] = [];
    for (const cookies of this.cookieArgSets()) {
      sets.push([url, ...this.globalArgs(), ...cookies, ...downloadArgs]);
    }
    return sets;
  }

  private resolveCookiesPath(): string | null {
    const configured = process.env.YT_DLP_COOKIES_FILE;
    if (!configured) return null;
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.join(this.monorepoRoot, configured);
    return fs.existsSync(resolved) ? resolved : null;
  }

  private cookieArgSets(): string[][] {
    const sets: string[][] = [[]];
    const cookiesPath = this.resolveCookiesPath();
    if (cookiesPath) {
      sets.unshift(['--cookies', cookiesPath]);
    }
    // Browser cookies trigger macOS Keychain prompts — dev-only, never for end users.
    const browser = process.env.YT_DLP_COOKIES_FROM_BROWSER?.trim();
    const allowBrowserCookies = process.env.YT_DLP_ENABLE_BROWSER_COOKIES === 'true';
    if (browser && allowBrowserCookies) {
      sets.unshift(['--cookies-from-browser', browser]);
    }
    return sets;
  }

  private pushVariant(
    variants: string[][],
    url: string,
    mode: 'metadata' | 'download',
    cookies: string[],
    client?: string,
    downloadArgs: string[] = [],
  ) {
    const extractor =
      client && url.includes('youtube')
        ? ['--extractor-args', `youtube:player_client=${client}`]
        : [];

    const shared = [...this.globalArgs(), ...cookies, '--no-playlist', '--no-warnings', ...extractor];

    if (mode === 'metadata') {
      variants.push([...shared, '--dump-json', url]);
    } else {
      variants.push([url, ...shared, ...downloadArgs]);
    }
  }

  /**
   * Height-capped fallbacks — cap by the shorter video edge (landscape: height, portrait: width).
   * Do not require both width AND height <= max — that rejects 854×480 and 1080×1920 streams.
   */
  private buildHeightCappedFallbacks(maxHeight: number): string {
    // Merge DASH first — combined 360p MP4 (format 18) must not win over 720p video+audio.
    return [
      `bestvideo[height<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/`,
      `bestvideo[width<=${maxHeight}][ext=mp4]+bestaudio[ext=m4a]/`,
      `bestvideo[height<=${maxHeight}]+bestaudio/`,
      `bestvideo[width<=${maxHeight}]+bestaudio/`,
      `best[height<=${maxHeight}][ext=mp4][acodec!=none]/`,
      `best[width<=${maxHeight}][ext=mp4][acodec!=none]/`,
      `best[height<=${maxHeight}][acodec!=none]/`,
      `best[width<=${maxHeight}][acodec!=none]/`,
      `best[acodec!=none]/best`,
    ].join('/');
  }

  /** Facebook/Instagram/TikTok — prefer progressive H.264 (hd/sd) over VP9 DASH. */
  private buildSocialFormatSelector(options: DownloadOptions): string {
    const { format, maxHeight } = options;
    if (format) {
      // Never fall back to bare format id — video-only DASH streams have no audio.
      return [
        `best[format_id=${format}][acodec!=none]`,
        `${format}+bestaudio`,
        `bestvideo[format_id=${format}]+bestaudio`,
        'hd',
        'sd',
        'best[acodec!=none]',
        'bestvideo+bestaudio/best',
      ].join('/');
    }
    if (maxHeight) {
      return [
        'hd',
        'sd',
        `bestvideo[vcodec^=avc1][height<=${maxHeight}]+bestaudio/`,
        `bestvideo[vcodec^=avc1][width<=${maxHeight}]+bestaudio/`,
        `bestvideo[height<=${maxHeight}]+bestaudio/`,
        `bestvideo[width<=${maxHeight}]+bestaudio/`,
        `best[height<=${maxHeight}][acodec!=none]/`,
        `best[width<=${maxHeight}][acodec!=none]/`,
        'best[acodec!=none]/bestvideo+bestaudio/best',
      ].join('/');
    }
    return 'hd/sd/bestvideo[vcodec^=avc1]+bestaudio/bestvideo+bestaudio/best';
  }

  private buildVideoFormatSelector(url: string, options: DownloadOptions): string {
    const platform = detectPlatform(url);
    if (isSocialPlatform(platform)) {
      return this.buildSocialFormatSelector(options);
    }

    const { format, maxHeight } = options;
    const heightFallback = maxHeight
      ? this.buildHeightCappedFallbacks(maxHeight)
      : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';

    if (format) {
      const cap = maxHeight ?? 4320;
      // Never request a bare video-only format id — always merge audio or use combined streams.
      return `best[format_id=${format}][acodec!=none]/${format}+bestaudio/bestvideo[format_id=${format}]+bestaudio/${this.buildHeightCappedFallbacks(cap)}`;
    }
    if (maxHeight) {
      return this.buildHeightCappedFallbacks(maxHeight);
    }
    return 'best[ext=mp4][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best';
  }

  private extractOutputDir(downloadArgs: string[]): string | null {
    const oIndex = downloadArgs.indexOf('-o');
    if (oIndex === -1 || oIndex + 1 >= downloadArgs.length) return null;
    return path.dirname(downloadArgs[oIndex + 1]);
  }

  private cleanOutputDir(outputDir: string) {
    if (!fs.existsSync(outputDir)) return;
    for (const file of fs.readdirSync(outputDir)) {
      if (file.startsWith('.')) continue;
      fs.rmSync(path.join(outputDir, file), { force: true });
    }
  }

  private findDownloadedFile(outputDir: string, preferredExts: string[] = []): string | null {
    if (!fs.existsSync(outputDir)) return null;
    const files = fs
      .readdirSync(outputDir)
      .filter((f) => !f.startsWith('.') && !f.endsWith('.part'));
    if (!files.length) return null;

    const normalized = preferredExts.map((e) => e.toLowerCase().replace(/^\./, ''));
    for (const ext of normalized) {
      const match = files.find((f) => f.toLowerCase().endsWith(`.${ext}`));
      if (match) return path.join(outputDir, match);
    }

    const ranked = files
      .map((f) => {
        const fp = path.join(outputDir, f);
        return { fp, size: fs.statSync(fp).size };
      })
      .sort((a, b) => b.size - a.size);
    return ranked[0]?.fp ?? null;
  }

  private async ensureMp3Output(filePath: string): Promise<string> {
    if (path.extname(filePath).toLowerCase() === '.mp3') {
      return filePath;
    }
    if (!this.ffmpegPath) {
      throw new Error(
        'Audio downloaded but MP3 conversion failed — ffmpeg is required. Install: brew install ffmpeg',
      );
    }

    const outputDir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    const mp3Path = path.join(outputDir, `${base}.mp3`);

    this.logger.log(`Converting ${path.basename(filePath)} to MP3 via ffmpeg`);
    await execa(this.ffmpegPath, [
      '-i',
      filePath,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      '-y',
      mp3Path,
    ]);

    if (filePath !== mp3Path) {
      fs.rmSync(filePath, { force: true });
    }
    return mp3Path;
  }

  private ffprobePath(): string | null {
    if (!this.ffmpegPath) return null;
    const probe = this.ffmpegPath.replace(/ffmpeg$/, 'ffprobe');
    return fs.existsSync(probe) ? probe : null;
  }

  private async probeStreamCodecs(
    filePath: string,
  ): Promise<{ video?: string; audio?: string }> {
    const ffprobe = this.ffprobePath();
    if (!ffprobe) return {};
    try {
      const { stdout } = await execa(
        ffprobe,
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_name,codec_type',
          '-of',
          'csv=p=0',
          filePath,
        ],
        { timeout: 30_000 },
      );
      const result: { video?: string; audio?: string } = {};
      for (const line of stdout.trim().split('\n')) {
        const [codec, type] = line.split(',');
        if (type === 'video' && !result.video) result.video = codec;
        if (type === 'audio' && !result.audio) result.audio = codec;
      }
      return result;
    } catch {
      return {};
    }
  }

  private needsCompatTranscode(codecs: { video?: string; audio?: string }): boolean {
    const video = codecs.video?.toLowerCase() ?? '';
    if (!video) return false;
    if (video.includes('h264') || video.includes('avc')) return false;
    return (
      video.includes('vp9') ||
      video.includes('vp09') ||
      video.includes('av1') ||
      video.includes('av01') ||
      video.includes('hevc') ||
      video.includes('hev1') ||
      video.includes('h265')
    );
  }

  /** Re-encode VP9/AV1/HEVC MP4 to H.264+AAC for QuickTime, Photos, etc. */
  async finishCompatTranscode(filePath: string): Promise<string> {
    return this.ensurePlayableMp4(filePath);
  }

  async probeVideoResolution(filePath: string): Promise<number | null> {
    return this.probeVideoShortEdge(filePath);
  }

  /** Ensure MP4 has audio and plays in QuickTime (H.264+AAC or faststart remux). */
  async ensurePlayableMp4(filePath: string): Promise<string> {
    if (!this.ffmpegPath || path.extname(filePath).toLowerCase() !== '.mp4') {
      return filePath;
    }

    const codecs = await this.probeStreamCodecs(filePath);
    if (!codecs.audio) {
      throw new Error('Downloaded file has no audio track');
    }

    if (this.needsCompatTranscode(codecs)) {
      return this.ensureCompatibleMp4(filePath);
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath, '.mp4');
    const tempPath = path.join(dir, `${base}.faststart.mp4`);
    try {
      await execa(
        this.ffmpegPath,
        ['-i', filePath, '-c', 'copy', '-movflags', '+faststart', '-y', tempPath],
        { timeout: 600_000 },
      );
      fs.rmSync(filePath, { force: true });
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      fs.rmSync(tempPath, { force: true });
      this.logger.warn(
        `faststart remux skipped for ${path.basename(filePath)}: ${err instanceof Error ? err.message : err}`,
      );
    }
    return filePath;
  }

  private async ensureCompatibleMp4(filePath: string): Promise<string> {
    if (!this.ffmpegPath || path.extname(filePath).toLowerCase() !== '.mp4') {
      return filePath;
    }

    const codecs = await this.probeStreamCodecs(filePath);
    if (!this.needsCompatTranscode(codecs)) {
      return filePath;
    }

    const dir = path.dirname(filePath);
    const base = path.basename(filePath, '.mp4');
    const tempPath = path.join(dir, `${base}.compat.mp4`);

    this.logger.log(
      `Transcoding ${path.basename(filePath)} (${codecs.video ?? 'unknown'}/${codecs.audio ?? 'none'}) to H.264+AAC`,
    );

    await execa(this.ffmpegPath, [
      '-i',
      filePath,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-y',
      tempPath,
    ]);

    fs.rmSync(filePath, { force: true });
    fs.renameSync(tempPath, filePath);
    return filePath;
  }

  private async probeVideoShortEdge(filePath: string): Promise<number | null> {
    const ffprobe = this.ffprobePath();
    if (!ffprobe) return null;
    try {
      const { stdout } = await execa(
        ffprobe,
        [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=width,height',
          '-of',
          'csv=p=0:s=x',
          filePath,
        ],
        { timeout: 30_000 },
      );
      const [width, height] = stdout.trim().split('x').map(Number);
      if (!width || !height) return null;
      return Math.min(width, height);
    } catch {
      return null;
    }
  }

  private buildArgVariants(
    url: string,
    mode: 'metadata' | 'download',
    downloadArgs: string[] = [],
  ): string[][] {
    const variants: string[][] = [];
    const cookieSets = this.cookieArgSets();
    const isYoutube = /youtube\.com|youtu\.be/i.test(url);

    if (isYoutube) {
      if (mode === 'metadata') {
        this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
        for (const client of YOUTUBE_METADATA_CLIENTS) {
          this.pushVariant(variants, url, mode, [], client, downloadArgs);
        }
      } else {
        // Default yt-dlp client first — web/mweb often expose only 360p (format 18).
        this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
        for (const client of YOUTUBE_DOWNLOAD_CLIENTS) {
          this.pushVariant(variants, url, mode, [], client, downloadArgs);
        }
      }
    } else {
      this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
    }

    // Authenticated path: cookies for age-restricted / sign-in required
    for (const cookies of cookieSets) {
      if (!cookies.length) continue;
      if (isYoutube) {
        const clients =
          mode === 'metadata'
            ? YOUTUBE_METADATA_CLIENTS
            : YOUTUBE_DOWNLOAD_CLIENTS;
        if (mode === 'download') {
          this.pushVariant(variants, url, mode, cookies, undefined, downloadArgs);
        }
        for (const client of clients) {
          this.pushVariant(variants, url, mode, cookies, client, downloadArgs);
        }
        if (mode === 'metadata') {
          this.pushVariant(variants, url, mode, cookies, undefined, downloadArgs);
        }
      } else {
        this.pushVariant(variants, url, mode, cookies, undefined, downloadArgs);
      }
    }

    return variants;
  }

  private downloadTimeoutMs(durationSeconds?: number, isPlaylist = false): number {
    if (isPlaylist) {
      const playlistConfigured = Number(process.env.YT_DLP_PLAYLIST_TIMEOUT_MS);
      if (playlistConfigured > 0) return playlistConfigured;
      return 6 * 60 * 60 * 1000;
    }
    const configured = Number(process.env.YT_DLP_DOWNLOAD_TIMEOUT_MS);
    if (configured > 0) return configured;
    if (durationSeconds && durationSeconds > 0) {
      // ~3× video length + 10 min buffer; min 30 min, max 3 hours
      return Math.min(10_800_000, Math.max(1_800_000, durationSeconds * 3000 + 600_000));
    }
    return 3_600_000;
  }

  private updatePlaylistProgress(
    state: { currentItem: number; totalItems: number | null; itemProgress: number },
    report: (percent: number) => void,
    phaseProgress: { value: number },
    onItemsProgress?: (completed: number, total: number | null) => void,
  ) {
    const total = state.totalItems ?? state.currentItem;
    if (total <= 0) return;
    const completed = Math.max(0, state.currentItem - 1);
    const itemFraction = state.itemProgress / 100;
    const overall = 10 + Math.round(((completed + itemFraction) / total) * 75);
    const pct = Math.min(84, Math.max(phaseProgress.value, overall));
    phaseProgress.value = pct;
    report(pct);
    onItemsProgress?.(completed + (state.itemProgress >= 100 ? 1 : 0), state.totalItems);
  }

  private handlePlaylistProgressLine(
    line: string,
    report: (percent: number) => void,
    phaseProgress: { value: number },
    playlistState: { currentItem: number; totalItems: number | null; itemProgress: number },
    onItemsProgress?: (completed: number, total: number | null) => void,
  ): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;

    const itemMatch = trimmed.match(/\[download\]\s+Downloading item (\d+) of (\d+)/i);
    if (itemMatch) {
      playlistState.currentItem = parseInt(itemMatch[1], 10);
      playlistState.totalItems = parseInt(itemMatch[2], 10);
      playlistState.itemProgress = 0;
      this.updatePlaylistProgress(playlistState, report, phaseProgress, onItemsProgress);
      return true;
    }

    if (/\[download\]\s+100(\.0+)?%\s+of/i.test(trimmed) && playlistState.currentItem > 0) {
      playlistState.itemProgress = 100;
      this.updatePlaylistProgress(playlistState, report, phaseProgress, onItemsProgress);
      return true;
    }

    const downloadMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (downloadMatch && playlistState.currentItem > 0) {
      playlistState.itemProgress = parseFloat(downloadMatch[1]);
      this.updatePlaylistProgress(playlistState, report, phaseProgress, onItemsProgress);
      return true;
    }

    return false;
  }

  private handleProgressLine(
    line: string,
    report: (percent: number) => void,
    phaseProgress: { value: number },
  ) {
    const trimmed = line.trim();
    if (!trimmed) return;

    const downloadMatch = trimmed.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (downloadMatch) {
      const pct = Math.min(95, Math.max(10, Math.round(parseFloat(downloadMatch[1]))));
      phaseProgress.value = Math.max(phaseProgress.value, pct);
      report(phaseProgress.value);
      return;
    }

    if (/\[Merger\]|\[ExtractAudio\]|Merging formats/i.test(trimmed)) {
      phaseProgress.value = Math.max(phaseProgress.value, 92);
      report(phaseProgress.value);
      return;
    }

    if (/\[youtube\]|\[info\]|\[ffmpeg\]|Extracting URL/i.test(trimmed)) {
      phaseProgress.value = Math.max(phaseProgress.value, 15);
      report(phaseProgress.value);
    }
  }

  private attachProgressStream(
    stream: NodeJS.ReadableStream | null | undefined,
    report: (percent: number) => void,
    phaseProgress: { value: number },
    buffers: { value: string },
    playlistState?: {
      state: { currentItem: number; totalItems: number | null; itemProgress: number };
      onItemsProgress?: (completed: number, total: number | null) => void;
    },
  ) {
    stream?.on('data', (chunk: Buffer | string) => {
      buffers.value += typeof chunk === 'string' ? chunk : chunk.toString();
      const parts = buffers.value.split(/\r|\n/);
      buffers.value = parts.pop() ?? '';
      for (const line of parts) {
        if (
          playlistState &&
          this.handlePlaylistProgressLine(
            line,
            report,
            phaseProgress,
            playlistState.state,
            playlistState.onItemsProgress,
          )
        ) {
          continue;
        }
        this.handleProgressLine(line, report, phaseProgress);
      }
    });
  }

  private async execDownload(
    args: string[],
    timeoutMs: number,
    onProgress?: (percent: number) => void,
    playlistProgress?: {
      onItemsProgress?: (completed: number, total: number | null) => void;
      outputDir?: string;
      tolerateErrors?: boolean;
    },
  ): Promise<void> {
    const phaseProgress = { value: 10 };
    const stdoutBuffer = { value: '' };
    const stderrBuffer = { value: '' };
    const playlistState = {
      currentItem: 0,
      totalItems: null as number | null,
      itemProgress: 0,
    };

    const report = (percent: number) => {
      if (!onProgress) return;
      onProgress(percent);
    };

    const heartbeat = onProgress
      ? setInterval(() => {
          if (phaseProgress.value < 84) {
            phaseProgress.value += 1;
            report(phaseProgress.value);
          }
        }, 20_000)
      : null;

    const streamOpts = playlistProgress
      ? { state: playlistState, onItemsProgress: playlistProgress.onItemsProgress }
      : undefined;

    const subprocess = execa(this.binary, args, {
      timeout: timeoutMs,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    this.attachProgressStream(subprocess.stdout, report, phaseProgress, stdoutBuffer, streamOpts);
    this.attachProgressStream(subprocess.stderr, report, phaseProgress, stderrBuffer, streamOpts);

    try {
      await subprocess;
      report(96);
      if (stdoutBuffer.value) {
        if (
          !playlistProgress ||
          !this.handlePlaylistProgressLine(
            stdoutBuffer.value,
            report,
            phaseProgress,
            playlistState,
            playlistProgress.onItemsProgress,
          )
        ) {
          this.handleProgressLine(stdoutBuffer.value, report, phaseProgress);
        }
      }
      if (stderrBuffer.value) {
        if (
          !playlistProgress ||
          !this.handlePlaylistProgressLine(
            stderrBuffer.value,
            report,
            phaseProgress,
            playlistState,
            playlistProgress.onItemsProgress,
          )
        ) {
          this.handleProgressLine(stderrBuffer.value, report, phaseProgress);
        }
      }
    } catch (err) {
      if (
        playlistProgress?.tolerateErrors &&
        playlistProgress.outputDir &&
        this.outputDirHasMedia(playlistProgress.outputDir)
      ) {
        this.logger.warn(
          `Playlist download finished with skipped items: ${YtDlpService.parseError(err)}`,
        );
        report(96);
        return;
      }
      throw err;
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  private async runWithFallback<T>(
    url: string,
    mode: 'metadata' | 'download',
    downloadArgs: string[],
    parse: (stdout: string) => T,
    downloadOpts?: Pick<
      DownloadOptions,
      'onProgress' | 'onItemsProgress' | 'durationSeconds' | 'maxHeight' | 'url' | 'isPlaylist' | 'format'
    >,
  ): Promise<T> {
    const variants = this.buildArgVariants(url, mode, downloadArgs);
    let lastError: unknown;
    let bestMeta: T | null = null;
    let bestFormatCount = 0;
    const downloadTimeout = this.downloadTimeoutMs(
      downloadOpts?.durationSeconds,
      downloadOpts?.isPlaylist,
    );
    const outputDir = mode === 'download' ? this.extractOutputDir(downloadArgs) : null;
    const platform = downloadOpts?.url ? detectPlatform(downloadOpts.url) : detectPlatform(url);
    const skipQualityProbe = isSocialPlatform(platform);
    const minHeight =
      !skipQualityProbe && downloadOpts?.maxHeight && downloadOpts.maxHeight >= 480
        ? Math.floor(downloadOpts.maxHeight * 0.85)
        : undefined;

    for (const args of variants) {
      try {
        if (mode === 'download') {
          if (outputDir) this.cleanOutputDir(outputDir);
          await this.execDownload(
            args,
            downloadTimeout,
            downloadOpts?.onProgress,
            downloadOpts?.isPlaylist
              ? {
                  onItemsProgress: downloadOpts.onItemsProgress,
                  outputDir: outputDir ?? undefined,
                  tolerateErrors: true,
                }
              : undefined,
          );

          if (minHeight && outputDir) {
            const file = this.findDownloadedFile(outputDir);
            if (file) {
              const edge = await this.probeVideoShortEdge(file);
              if (edge && edge < minHeight) {
                this.logger.warn(
                  `Download resolved to ${edge}p (requested ~${downloadOpts!.maxHeight}p) — trying next client`,
                );
                continue;
              }
            }
          }

          return parse('');
        }

        const { stdout } = await execa(this.binary, args, { timeout: 120_000 });
        const result = parse(stdout);

        const count = (result as VideoMetadata).formats?.length ?? 0;
        if (count > bestFormatCount) {
          bestFormatCount = count;
          bestMeta = result;
        }
        if (count >= 2) return result;
      } catch (err) {
        lastError = err;
        this.logger.warn(`yt-dlp attempt failed: ${YtDlpService.parseError(err)}`);
      }
    }

    if (bestMeta) return bestMeta;
    throw new Error(YtDlpService.parseError(lastError));
  }

  private mapVideoFormats(rawFormats: Record<string, unknown>[], url: string) {
    const platform = detectPlatform(url);
    const social = isSocialPlatform(platform);

    const effectiveResolution = (height?: number, width?: number) => {
      if (height && width) return Math.min(height, width);
      return height ?? width ?? 0;
    };

    const hasVideo = (f: Record<string, unknown>) => {
      const id = String(f.format_id ?? '');
      if (id.startsWith('sb')) return false;
      const vcodec = f.vcodec as string | undefined;
      if (!vcodec || vcodec === 'none') return false;
      const height = f.height as number | undefined;
      const width = f.width as number | undefined;
      const size = effectiveResolution(height, width);
      return Boolean(size >= 144);
    };

    const mapped = rawFormats.filter(hasVideo).map((f: Record<string, unknown>) => {
      const height = f.height as number | undefined;
      const width = f.width as number | undefined;
      return {
        format_id: f.format_id as string,
        ext: f.ext as string,
        width,
        height,
        filesize: (f.filesize as number | undefined) ?? undefined,
        filesize_approx: (f.filesize_approx as number | undefined) ?? undefined,
        tbr: (f.tbr as number | undefined) ?? undefined,
        vbr: (f.vbr as number | undefined) ?? undefined,
        abr: (f.abr as number | undefined) ?? undefined,
        fps: (f.fps as number | undefined) ?? undefined,
        vcodec: f.vcodec as string,
        acodec: (f.acodec as string | undefined) ?? 'none',
      };
    });

    if (mapped.length > 0) return mapped;

    const fallback = rawFormats.find((f) => {
      const vcodec = f.vcodec as string | undefined;
      return vcodec && vcodec !== 'none';
    });

    if (!fallback) return [];

    const fbHeight = fallback.height as number | undefined;
    const fbWidth = fallback.width as number | undefined;
    return [
      {
        format_id: fallback.format_id as string,
        ext: (fallback.ext as string) ?? 'mp4',
        width: fbWidth,
        height: fbHeight ?? (social ? 1280 : undefined),
        filesize: (fallback.filesize as number | undefined) ?? undefined,
        filesize_approx: (fallback.filesize_approx as number | undefined) ?? undefined,
        tbr: (fallback.tbr as number | undefined) ?? undefined,
        vbr: (fallback.vbr as number | undefined) ?? undefined,
        abr: (fallback.abr as number | undefined) ?? undefined,
        fps: (fallback.fps as number | undefined) ?? undefined,
        vcodec: fallback.vcodec as string,
        acodec: (fallback.acodec as string | undefined) ?? 'none',
      },
    ];
  }

  private resolveThumbnail(data: Record<string, unknown>): {
    url: string;
    width?: number;
    height?: number;
  } {
    const thumbnails =
      (data.thumbnails as Array<{ url?: string; width?: number; height?: number }>) ?? [];
    if (thumbnails.length > 0) {
      const best = thumbnails
        .filter((t) => t.url)
        .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];
      if (best?.url) {
        return {
          url: best.url,
          width: best.width,
          height: best.height,
        };
      }
    }

    const direct = data.thumbnail as string | undefined;
    if (direct) return { url: direct };

    const formats = (data.formats as Array<{ url?: string; vcodec?: string }>) ?? [];
    const preview = formats.find((f) => f.url && f.vcodec && f.vcodec !== 'none');
    return { url: preview?.url ?? '' };
  }

  private extractYouTubeVideoId(url: string, dataId?: string): string | null {
    if (dataId && /^[\w-]{6,}$/.test(dataId)) return dataId;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        return parsed.pathname.slice(1).split('/')[0] || null;
      }
      const list = parsed.searchParams.get('v');
      if (list) return list;
    } catch {
      // fall through
    }
    const match = url.match(/(?:v=|\/vi\/|youtu\.be\/)([\w-]{6,})/);
    return match?.[1] ?? null;
  }

  private youTubeThumbnailCandidates(videoId: string, fallbackUrl?: string): string[] {
    const urls = [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi_webp/${videoId}/maxresdefault.webp`,
      `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ];
    if (fallbackUrl) {
      urls.push(fallbackUrl);
      const upgraded = fallbackUrl.replace(/\/(hq|mq|sd)default(\.\w+)?$/i, '/maxresdefault$2');
      if (upgraded !== fallbackUrl) urls.unshift(upgraded);
    }
    return [...new Set(urls)];
  }

  private async probeImageUrl(
    url: string,
  ): Promise<{ url: string; width: number; height: number } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HelloDownloader/1.0)' },
      });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(buf).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      // YouTube returns a tiny placeholder when maxres is unavailable.
      if (width < 320 || height < 180) return null;
      return { url, width, height };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Pick the largest verified thumbnail (YouTube maxres first, then yt-dlp file). */
  async resolveBestThumbnail(
    pageUrl: string,
    options: { videoId?: string; fallbackUrl?: string; fallbackWidth?: number; fallbackHeight?: number },
  ): Promise<{ url: string; width: number; height: number; source: 'youtube-maxres' | 'metadata' | 'yt-dlp' }> {
    const videoId = this.extractYouTubeVideoId(pageUrl, options.videoId);

    // YouTube: use CDN URL immediately — probing every candidate adds 10–60s.
    if (videoId && /youtube\.com|youtu\.be/i.test(pageUrl)) {
      return {
        url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        width: 480,
        height: 360,
        source: 'youtube-maxres',
      };
    }

    const candidates: string[] = [];

    if (videoId && /youtube\.com|youtu\.be/i.test(pageUrl)) {
      candidates.push(...this.youTubeThumbnailCandidates(videoId, options.fallbackUrl));
    } else if (options.fallbackUrl) {
      candidates.push(options.fallbackUrl);
    }

    let best: { url: string; width: number; height: number; source: 'youtube-maxres' | 'metadata' } | null =
      null;
    for (const candidate of candidates) {
      const probed = await this.probeImageUrl(candidate);
      if (!probed) continue;
      const area = probed.width * probed.height;
      if (!best || area > best.width * best.height) {
        best = {
          ...probed,
          source: candidate.includes('maxres') ? 'youtube-maxres' : 'metadata',
        };
      }
    }

    const fallbackArea = (options.fallbackWidth ?? 0) * (options.fallbackHeight ?? 0);
    if (best && best.width * best.height >= fallbackArea) {
      return best;
    }

    try {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hd-thumb-'));
      const outBase = path.join(tmpDir, 'thumb');
      await execa(this.binary, [
        pageUrl,
        ...this.globalArgs(),
        '--write-thumbnail',
        '--skip-download',
        '-o',
        outBase,
      ], { timeout: 60_000 });
      const thumbFile = fs.readdirSync(tmpDir).find((f) => f.startsWith('thumb'));
      if (thumbFile) {
        const filePath = path.join(tmpDir, thumbFile);
        const meta = await sharp(filePath).metadata();
        const width = meta.width ?? 0;
        const height = meta.height ?? 0;
        fs.rmSync(tmpDir, { recursive: true, force: true });
        if (width >= 320 && height >= 180) {
          if (!best || width * height > best.width * best.height) {
            const url =
              videoId && /youtube\.com|youtu\.be/i.test(pageUrl)
                ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
                : options.fallbackUrl ?? '';
            if (url) {
              return { url, width, height, source: 'yt-dlp' };
            }
          }
        }
      } else {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (err) {
      this.logger.warn(`yt-dlp thumbnail probe failed: ${YtDlpService.parseError(err)}`);
    }

    if (best) return best;

    if (options.fallbackUrl) {
      return {
        url: options.fallbackUrl,
        width: options.fallbackWidth ?? 0,
        height: options.fallbackHeight ?? 0,
        source: 'metadata',
      };
    }

    throw new Error('No thumbnail found for this video');
  }

  async extractMetadata(url: string): Promise<VideoMetadata> {
    return this.runWithFallback(url, 'metadata', [], (stdout) => {
      const data = JSON.parse(stdout);
      const thumb = this.resolveThumbnail(data);
      const videoId = typeof data.id === 'string' ? data.id : '';
      const isYoutube = /youtube\.com|youtu\.be/i.test(url);
      const thumbnail =
        isYoutube && videoId
          ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          : thumb.url;
      return {
        id: data.id,
        title: data.title ?? 'Unknown title',
        thumbnail,
        thumbnailWidth: isYoutube ? 480 : thumb.width,
        thumbnailHeight: isYoutube ? 360 : thumb.height,
        duration: Math.round(Number(data.duration) || 0),
        uploader: data.uploader ?? data.channel ?? data.uploader_id ?? 'Unknown',
        formats: this.mapVideoFormats(data.formats ?? [], url),
      };
    });
  }

  async downloadVideo(url: string, outputDir: string, options: DownloadOptions = {}): Promise<string> {
    fs.mkdirSync(outputDir, { recursive: true });
    const outputTemplate = path.join(outputDir, 'video.%(ext)s');

    const formatArgs: string[] = [
      '-o',
      outputTemplate,
      ...this.buildSpeedArgs(url),
      '--newline',
      '--progress',
      '--retries',
      '5',
      '--fragment-retries',
      '10',
      '--no-abort-on-error',
    ];
    if (options.audioOnly) {
      if (!this.ffmpegPath) {
        throw new Error(
          'ffmpeg is required for MP3/audio conversion. Install: brew install ffmpeg',
        );
      }
      formatArgs.push(
        '-f',
        'bestaudio/best',
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '--embed-thumbnail',
      );
    } else if (options.format || options.maxHeight) {
      formatArgs.push(
        '-f',
        this.buildVideoFormatSelector(url, options),
        '--merge-output-format',
        'mp4',
        '--postprocessor-args',
        'ffmpeg:-movflags +faststart',
      );
    } else {
      formatArgs.push(
        '-f',
        'best[ext=mp4][acodec!=none]/bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
        '--postprocessor-args',
        'ffmpeg:-movflags +faststart',
      );
    }

    const runDownload = (opts: DownloadOptions) => {
      const args = [...formatArgs];
      const fIndex = args.indexOf('-f');
      if (fIndex !== -1) {
        args[fIndex + 1] = this.buildVideoFormatSelector(url, opts);
      }
      return this.runWithFallback(url, 'download', args, () => undefined, {
        onProgress: options.onProgress,
        durationSeconds: options.durationSeconds,
        maxHeight: opts.maxHeight,
        format: opts.format,
        url,
      });
    };

    try {
      await runDownload(options);
    } catch (err) {
      const msg = YtDlpService.parseError(err);
      if (
        options.format &&
        /not available|quality too low/i.test(msg)
      ) {
        this.logger.warn(
          `Format ${options.format} unavailable at ${options.maxHeight ?? '?'}p — retrying with height cap only`,
        );
        await runDownload({ ...options, format: undefined });
      } else if (
        options.maxHeight &&
        /not available|quality too low/i.test(msg)
      ) {
        this.logger.warn(
          `Quality cap ${options.maxHeight}p unavailable — retrying with best available format`,
        );
        await runDownload({ ...options, format: undefined, maxHeight: undefined });
      } else {
        throw err;
      }
    }

    const preferredExts = options.audioOnly ? ['mp3', 'm4a', 'opus', 'webm', 'aac', 'mp4'] : [];
    let filePath = this.findDownloadedFile(outputDir, preferredExts);
    if (!filePath) throw new Error('Download produced no files');

    if (options.audioOnly) {
      filePath = await this.ensureMp3Output(filePath);
      return filePath;
    }

    options.onProgress?.(90);
    try {
      filePath = await this.ensurePlayableMp4(filePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/no audio track/i.test(msg) && (options.format || options.maxHeight)) {
        this.logger.warn('Download missing audio — retrying without format id');
        await runDownload({ ...options, format: undefined });
        filePath = this.findDownloadedFile(outputDir, preferredExts);
        if (!filePath) throw new Error('Download produced no files');
        filePath = await this.ensurePlayableMp4(filePath);
      } else {
        throw err;
      }
    }
    options.onProgress?.(98);
    return filePath;
  }

  async getPlaylistEntryCount(url: string): Promise<number | null> {
    for (const cookies of this.cookieArgSets()) {
      try {
        const { stdout } = await execa(
          this.binary,
          [...this.globalArgs(), ...cookies, '--flat-playlist', '--print', 'id', '--skip-download', url],
          { timeout: 120_000 },
        );
        const lines = stdout.trim().split('\n').filter(Boolean);
        return lines.length > 0 ? lines.length : null;
      } catch (err) {
        this.logger.warn(`Playlist count probe failed: ${YtDlpService.parseError(err)}`);
      }
    }
    return null;
  }

  async downloadPlaylist(
    url: string,
    outputDir: string,
    options: PlaylistDownloadOptions = {},
  ): Promise<string[]> {
    fs.mkdirSync(outputDir, { recursive: true });
    const downloadArgs = [
      '-o',
      path.join(outputDir, '%(playlist_index)s-%(title).50B.%(ext)s'),
      '--yes-playlist',
      '--ignore-errors',
      '--no-abort-on-error',
      ...this.buildSpeedArgs(url),
      '--newline',
      '--progress',
      '--retries',
      '5',
      '--fragment-retries',
      '10',
    ];
    if (options.maxHeight) {
      downloadArgs.push(
        '-f',
        `best[height<=${options.maxHeight}][ext=mp4][acodec!=none]/` +
          `best[height<=${options.maxHeight}]/` +
          `bestvideo[height<=${options.maxHeight}]+bestaudio/best[height<=${options.maxHeight}]`,
        '--merge-output-format',
        'mp4',
      );
    }

    const timeout = this.downloadTimeoutMs(undefined, true);
    const argSets = this.buildPlaylistDownloadArgSets(url, downloadArgs);
    let lastError: unknown = null;

    for (const args of argSets) {
      try {
        if (!this.outputDirHasMedia(outputDir)) {
          this.cleanOutputDir(outputDir);
        }
        await this.execDownload(args, timeout, options.onProgress, {
          onItemsProgress: options.onItemsProgress,
          outputDir,
          tolerateErrors: true,
        });
        break;
      } catch (err) {
        lastError = err;
        if (this.outputDirHasMedia(outputDir)) {
          this.logger.warn(
            `Playlist download recovered with partial files: ${YtDlpService.parseError(err)}`,
          );
          break;
        }
        this.logger.warn(`Playlist yt-dlp attempt failed: ${YtDlpService.parseError(err)}`);
      }
    }

    const files = this.listMediaFiles(outputDir);
    if (!files.length) {
      throw new Error(YtDlpService.parsePlaylistError(lastError ?? new Error('No files produced')));
    }
    return files;
  }

  async downloadSubtitles(url: string, outputDir: string): Promise<string[]> {
    fs.mkdirSync(outputDir, { recursive: true });
    await this.runWithFallback(
      url,
      'download',
      [
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang',
        'en',
        '--skip-download',
        '-o',
        path.join(outputDir, '%(title)s'),
      ],
      () => undefined,
    );
    return fs
      .readdirSync(outputDir)
      .filter((f) => f.endsWith('.vtt') || f.endsWith('.srt'))
      .map((f) => path.join(outputDir, f));
  }

  async downloadThumbnail(url: string, outputPath: string): Promise<string> {
    const meta = await this.extractMetadata(url);
    const res = await fetch(meta.thumbnail);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }
}
