import * as fs from 'fs';
import * as path from 'path';

/** Remove a file or directory tree (best-effort). */
export function removePathRecursive(target: string): void {
  if (!fs.existsSync(target)) return;

  if (fs.statSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      removePathRecursive(path.join(target, entry));
    }
    fs.rmdirSync(target);
    return;
  }

  fs.unlinkSync(target);
}

/** Delete empty directories under root (deepest first). */
export function removeEmptyDirs(root: string): void {
  if (!fs.existsSync(root)) return;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(root, entry.name);
    removeEmptyDirs(full);
    if (fs.existsSync(full) && fs.readdirSync(full).length === 0) {
      fs.rmdirSync(full);
    }
  }
}

export function getThumbnailRetentionCount(): number {
  const parsed = parseInt(process.env.THUMBNAIL_RETENTION_COUNT ?? '10', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 100);
}
