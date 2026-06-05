import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private s3: S3Client | null = null;
  private bucket: string;
  private publicUrl: string;
  private localPath: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME ?? 'hellodownloader';
    this.publicUrl = process.env.R2_PUBLIC_URL ?? '';
    this.localPath = process.env.STORAGE_PATH ?? './storage';

    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
    }
  }

  getLocalPath(...segments: string[]): string {
    const full = path.join(this.localPath, ...segments);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    return full;
  }

  async uploadFile(localPath: string, key: string, contentType?: string): Promise<string> {
    if (!this.s3) {
      const dest = this.getLocalPath(key);
      fs.copyFileSync(localPath, dest);
      return dest;
    }

    const body = fs.readFileSync(localPath);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType ?? 'application/octet-stream',
      }),
    );

    return this.publicUrl ? `${this.publicUrl}/${key}` : key;
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (!this.s3) return this.getLocalPath(key);
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async deleteFile(key: string): Promise<void> {
    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }
    const local = this.getLocalPath(key);
    if (fs.existsSync(local)) fs.unlinkSync(local);
  }

  async cleanupOlderThan(hours: number): Promise<number> {
    const tempDir = this.getLocalPath('temp');
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
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

    walk(tempDir);
    walk(this.getLocalPath('downloads'));
    walk(this.getLocalPath('playlists'));
    return removed;
  }
}
