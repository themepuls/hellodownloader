import * as fs from 'fs';
import * as path from 'path';

export async function cleanupFiles(retentionHours: number): Promise<number> {
  const storagePath = process.env.STORAGE_PATH ?? './storage';
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  let removed = 0;

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed++;
      }
    }
  };

  walk(path.join(storagePath, 'temp'));
  walk(path.join(storagePath, 'downloads'));
  return removed;
}
