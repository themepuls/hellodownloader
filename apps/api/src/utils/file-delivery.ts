import { createReadStream, createWriteStream, existsSync, unlinkSync } from 'fs';
import type { ReadStream } from 'fs';
import * as path from 'path';

export function shouldDeleteAfterDownload(): boolean {
  return process.env.DELETE_FILE_AFTER_DOWNLOAD !== 'false';
}

export function deleteLocalFile(filePath: string): void {
  if (filePath && existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function assertPathUnderStorageRoot(filePath: string): string {
  const storageRoot = path.resolve(process.env.STORAGE_PATH ?? './storage');
  const resolved = path.resolve(filePath);
  const relative = path.relative(storageRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Access denied');
  }
  return resolved;
}

export function deliverLocalFile(filePath: string): ReadStream {
  const safePath = assertPathUnderStorageRoot(filePath);
  if (!existsSync(safePath)) {
    throw new Error('File not found');
  }
  return createReadStream(safePath);
}

export { createReadStream, createWriteStream };
