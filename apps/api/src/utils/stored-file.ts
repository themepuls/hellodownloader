import { existsSync } from 'fs';
import { isR2Reference } from './r2-storage';

/** True when the DB path points to a local file or a Cloudflare R2 object. */
export function isStoredFileAvailable(ref: string | null | undefined): boolean {
  if (!ref) return false;
  if (isR2Reference(ref)) return true;
  return existsSync(ref);
}
