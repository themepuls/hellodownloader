import { Injectable, Logger } from '@nestjs/common';
import { detectPlatform, isSocialPlatform } from '@hellodownloader/shared-types';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs';

export interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  formats: Array<{
    format_id: string;
    ext: string;
    width?: number;
    height?: number;
    filesize?: number;
    filesize_approx?: number;
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
  onProgress?: (percent: number) => void;
}

/** Metadata: default/web first — android client only returns ~5 formats */
const YOUTUBE_METADATA_CLIENTS = [
  'web',
  'mweb,web',
  'ios,tv_embedded,android',
  'android,web',
] as const;

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

  private buildArgVariants(url: string, mode: 'metadata' | 'download', downloadArgs: string[] = []): string[][] {
    const variants: string[][] = [];
    const cookieSets = this.cookieArgSets();
    const isYoutube = /youtube\.com|youtu\.be/i.test(url);

    const youtubeClients =
      mode === 'metadata' ? YOUTUBE_METADATA_CLIENTS : (['android,web'] as const);

    if (isYoutube) {
      if (mode === 'metadata') {
        this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
      }
      for (const client of youtubeClients) {
        this.pushVariant(variants, url, mode, [], client, downloadArgs);
      }
      if (mode === 'download') {
        this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
      }
    } else {
      this.pushVariant(variants, url, mode, [], undefined, downloadArgs);
    }

    // Authenticated path: cookies for age-restricted / sign-in required
    for (const cookies of cookieSets) {
      if (!cookies.length) continue;
      if (isYoutube) {
        for (const client of youtubeClients) {
          this.pushVariant(variants, url, mode, cookies, client, downloadArgs);
        }
      }
      this.pushVariant(variants, url, mode, cookies, undefined, downloadArgs);
    }

    return variants;
  }

  private downloadTimeoutMs(durationSeconds?: number): number {
    const configured = Number(process.env.YT_DLP_DOWNLOAD_TIMEOUT_MS);
    if (configured > 0) return configured;
    if (durationSeconds && durationSeconds > 0) {
      // ~3× video length + 10 min buffer; min 30 min, max 3 hours
      return Math.min(10_800_000, Math.max(1_800_000, durationSeconds * 3000 + 600_000));
    }
    return 3_600_000;
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
  ) {
    stream?.on('data', (chunk: Buffer | string) => {
      buffers.value += typeof chunk === 'string' ? chunk : chunk.toString();
      const parts = buffers.value.split(/\r|\n/);
      buffers.value = parts.pop() ?? '';
      for (const line of parts) {
        this.handleProgressLine(line, report, phaseProgress);
      }
    });
  }

  private async execDownload(
    args: string[],
    timeoutMs: number,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const phaseProgress = { value: 10 };
    const stdoutBuffer = { value: '' };
    const stderrBuffer = { value: '' };

    const report = (percent: number) => {
      if (!onProgress) return;
      onProgress(percent);
    };

    const heartbeat = onProgress
      ? setInterval(() => {
          if (phaseProgress.value < 28) {
            phaseProgress.value += 1;
            report(phaseProgress.value);
          }
        }, 15_000)
      : null;

    const subprocess = execa(this.binary, args, {
      timeout: timeoutMs,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    this.attachProgressStream(subprocess.stdout, report, phaseProgress, stdoutBuffer);
    this.attachProgressStream(subprocess.stderr, report, phaseProgress, stderrBuffer);

    try {
      await subprocess;
      report(96);
      if (stdoutBuffer.value) {
        this.handleProgressLine(stdoutBuffer.value, report, phaseProgress);
      }
      if (stderrBuffer.value) {
        this.handleProgressLine(stderrBuffer.value, report, phaseProgress);
      }
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
  }

  private async runWithFallback<T>(
    url: string,
    mode: 'metadata' | 'download',
    downloadArgs: string[],
    parse: (stdout: string) => T,
    downloadOpts?: Pick<DownloadOptions, 'onProgress' | 'durationSeconds'>,
  ): Promise<T> {
    const variants = this.buildArgVariants(url, mode, downloadArgs);
    let lastError: unknown;
    let bestMeta: T | null = null;
    let bestFormatCount = 0;
    const downloadTimeout = this.downloadTimeoutMs(downloadOpts?.durationSeconds);

    for (const args of variants) {
      try {
        if (mode === 'download') {
          await this.execDownload(args, downloadTimeout, downloadOpts?.onProgress);
          return parse('');
        }

        const { stdout } = await execa(this.binary, args, { timeout: 120_000 });
        const result = parse(stdout);

        const count = (result as VideoMetadata).formats?.length ?? 0;
        if (count > bestFormatCount) {
          bestFormatCount = count;
          bestMeta = result;
        }
        if (count >= 12) return result;
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
        fps: (fallback.fps as number | undefined) ?? undefined,
        vcodec: fallback.vcodec as string,
        acodec: (fallback.acodec as string | undefined) ?? 'none',
      },
    ];
  }

  private resolveThumbnail(data: Record<string, unknown>): string {
    const thumbnails = (data.thumbnails as Array<{ url?: string; width?: number }>) ?? [];
    if (thumbnails.length > 0) {
      const best = thumbnails
        .filter((t) => t.url)
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
      if (best?.url) return best.url;
    }

    const direct = data.thumbnail as string | undefined;
    if (direct) return direct;

    const formats = (data.formats as Array<{ url?: string; vcodec?: string }>) ?? [];
    const preview = formats.find((f) => f.url && f.vcodec && f.vcodec !== 'none');
    return preview?.url ?? '';
  }

  async extractMetadata(url: string): Promise<VideoMetadata> {
    return this.runWithFallback(url, 'metadata', [], (stdout) => {
      const data = JSON.parse(stdout);
      return {
        id: data.id,
        title: data.title ?? 'Unknown title',
        thumbnail: this.resolveThumbnail(data),
        duration: data.duration ?? 0,
        uploader: data.uploader ?? data.channel ?? data.uploader_id ?? 'Unknown',
        formats: this.mapVideoFormats(data.formats ?? [], url),
      };
    });
  }

  async downloadVideo(url: string, outputDir: string, options: DownloadOptions = {}): Promise<string> {
    fs.mkdirSync(outputDir, { recursive: true });
    const outputTemplate = path.join(outputDir, '%(title).100B.%(ext)s');

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
      formatArgs.push('-x', '--audio-format', 'mp3', '-f', 'bestaudio/best');
    } else if (options.format) {
      // Prefer single-file format (no ffmpeg merge) when available — much faster
      formatArgs.push(
        '-f',
        `${options.format}/best[format_id=${options.format}]/${options.format}+bestaudio/best`,
        '--merge-output-format',
        'mp4',
      );
    } else if (options.maxHeight) {
      formatArgs.push(
        '-f',
        `best[height<=${options.maxHeight}][ext=mp4][acodec!=none]/` +
          `best[height<=${options.maxHeight}]/` +
          `bestvideo[height<=${options.maxHeight}][ext=mp4]+bestaudio[ext=m4a]/` +
          `bestvideo[height<=${options.maxHeight}]+bestaudio/best[height<=${options.maxHeight}]`,
        '--merge-output-format',
        'mp4',
      );
    } else {
      formatArgs.push(
        '-f',
        'best[ext=mp4][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
        '--merge-output-format',
        'mp4',
      );
    }

    await this.runWithFallback(url, 'download', formatArgs, () => undefined, {
      onProgress: options.onProgress,
      durationSeconds: options.durationSeconds,
    });

    const files = fs.readdirSync(outputDir).filter((f) => !f.startsWith('.'));
    if (!files.length) throw new Error('Download produced no files');
    return path.join(outputDir, files[0]);
  }

  async downloadPlaylist(url: string, outputDir: string, maxHeight?: number): Promise<string[]> {
    fs.mkdirSync(outputDir, { recursive: true });
    const baseArgs = [
      '-o',
      path.join(outputDir, '%(playlist_index)s-%(title).50B.%(ext)s'),
      '--yes-playlist',
      ...this.buildSpeedArgs(url),
      '--newline',
      '--progress',
      '--retries',
      '5',
      '--fragment-retries',
      '10',
    ];
    if (maxHeight) {
      baseArgs.push(
        '-f',
        `best[height<=${maxHeight}][ext=mp4][acodec!=none]/` +
          `best[height<=${maxHeight}]/` +
          `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`,
        '--merge-output-format',
        'mp4',
      );
    }
    await this.runWithFallback(url, 'download', baseArgs, () => undefined);
    return fs
      .readdirSync(outputDir)
      .filter((f) => !f.startsWith('.'))
      .map((f) => path.join(outputDir, f));
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
