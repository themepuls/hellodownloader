export const R2_SCHEME = 'r2://';

export function isR2Reference(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(R2_SCHEME));
}

export function toR2Reference(key: string): string {
  return `${R2_SCHEME}${key}`;
}

export function fromR2Reference(ref: string): string {
  return ref.startsWith(R2_SCHEME) ? ref.slice(R2_SCHEME.length) : ref;
}

export function contentTypeForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'zip':
      return 'application/zip';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'vtt':
      return 'text/vtt';
    case 'srt':
      return 'application/x-subrip';
    default:
      return 'application/octet-stream';
  }
}
