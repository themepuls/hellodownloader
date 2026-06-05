import { createReadStream, createWriteStream, existsSync, unlinkSync } from 'fs';
import type { ReadStream } from 'fs';

export function shouldDeleteAfterDownload(): boolean {
  return process.env.DELETE_FILE_AFTER_DOWNLOAD !== 'false';
}

export function deleteLocalFile(filePath: string): void {
  if (filePath && existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

export function deliverLocalFile(filePath: string): ReadStream {
  if (!existsSync(filePath)) {
    throw new Error('File not found');
  }
  return createReadStream(filePath);
}

export { createReadStream, createWriteStream };
