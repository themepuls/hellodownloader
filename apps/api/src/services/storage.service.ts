import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import * as tls from 'tls';
import type { StorageSettingsCredentials } from '@hellodownloader/shared-types';
import { isValidR2AccountId } from '@hellodownloader/shared-types';
import { StorageSettingsService } from '../modules/storage-settings/storage-settings.service';
import { removeEmptyDirs } from '../utils/fs-utils';
import {
  contentTypeForPath,
  fromR2Reference,
  isR2Reference,
  toR2Reference,
} from '../utils/r2-storage';

export { isR2Reference, toR2Reference, fromR2Reference };

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private localPath: string;
  private s3Client: S3Client | null = null;
  private s3ConfigKey = '';

  constructor(private storageSettings: StorageSettingsService) {
    this.localPath = process.env.STORAGE_PATH ?? './storage';
  }

  private async resolveR2(): Promise<{
    client: S3Client | null;
    bucket: string;
    publicUrl: string;
    credentials: StorageSettingsCredentials;
  }> {
    const credentials = await this.storageSettings.getCredentials();
    if (!this.storageSettings.isR2Configured(credentials)) {
      return { client: null, bucket: credentials.bucketName, publicUrl: credentials.publicUrl, credentials };
    }

    const configKey = [
      credentials.accountId,
      credentials.accessKeyId,
      credentials.secretAccessKey.slice(-4),
      credentials.bucketName,
    ].join(':');

    if (!this.s3Client || this.s3ConfigKey !== configKey) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${credentials.accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
      });
      this.s3ConfigKey = configKey;
    }

    return {
      client: this.s3Client,
      bucket: credentials.bucketName,
      publicUrl: credentials.publicUrl,
      credentials,
    };
  }

  getLocalPath(...segments: string[]): string {
    const full = path.join(this.localPath, ...segments);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    return full;
  }

  async isR2Enabled(): Promise<boolean> {
    const { client } = await this.resolveR2();
    return client !== null;
  }

  private probeR2Tls(accountId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const host = `${accountId}.r2.cloudflarestorage.com`;
      const socket = tls.connect(
        443,
        host,
        { servername: host, rejectUnauthorized: true },
        () => {
          socket.end();
          resolve(true);
        },
      );
      socket.setTimeout(10_000, () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => resolve(false));
    });
  }

  async testR2Connection(): Promise<{ ok: boolean; message: string }> {
    const { client, bucket, credentials } = await this.resolveR2();
    if (!client) {
      return { ok: false, message: 'R2 is not enabled or credentials are incomplete' };
    }
    if (!isValidR2AccountId(credentials.accountId)) {
      return {
        ok: false,
        message:
          'Account ID must be a 32-character hex string from Cloudflare → R2 → Account ID. Do not paste the endpoint URL into Secret Access Key.',
      };
    }
    const tlsOk = await this.probeR2Tls(credentials.accountId);
    if (!tlsOk) {
      return {
        ok: false,
        message: `Cannot reach R2 for account "${credentials.accountId}". Open Cloudflare → R2 and copy Account ID from the overview page (same account where bucket "${bucket}" exists). If R2 was just enabled, wait ~30 minutes and try again.`,
      };
    }
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { ok: true, message: `Connected to bucket "${bucket}"` };
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Connection failed';
      if (/EPROTO|handshake failure|SSL alert number 40/i.test(raw)) {
        return {
          ok: false,
          message:
            'TLS handshake failed for this Account ID. In Cloudflare → R2, copy the Account ID from the dashboard (32-character hex). Do not paste the endpoint URL into Account ID or Secret Access Key. New R2 accounts can take up to ~30 minutes before the endpoint works.',
        };
      }
      return { ok: false, message: raw };
    }
  }

  async uploadFile(localPath: string, key: string, contentType?: string): Promise<string> {
    const { client, bucket, publicUrl } = await this.resolveR2();

    if (!client) {
      const dest = this.getLocalPath(key);
      fs.copyFileSync(localPath, dest);
      return dest;
    }

    const body = fs.readFileSync(localPath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType ?? contentTypeForPath(localPath),
      }),
    );

    this.logger.log(`R2 uploaded ${key} (${body.length} bytes) to ${bucket}`);

    return publicUrl ? `${publicUrl}/${key}` : toR2Reference(key);
  }

  /** Upload local file to R2 when enabled; delete local copy and return r2:// reference. */
  async persistLocalFile(localPath: string, key: string): Promise<string> {
    if (!(await this.isR2Enabled())) {
      return localPath;
    }
    await this.uploadFile(localPath, key, contentTypeForPath(localPath));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return toR2Reference(key);
  }

  /**
   * Keep serving from local disk immediately; mirror to R2 after the job is marked complete.
   * Local file is removed only after a successful upload.
   */
  scheduleBackgroundR2Persist(
    localPath: string,
    key: string,
    onStored: (storedPath: string) => Promise<void>,
  ): void {
    void (async () => {
      try {
        if (!(await this.isR2Enabled())) return;
        const stored = await this.persistLocalFile(localPath, key);
        await onStored(stored);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Background R2 upload failed for ${key}: ${message}`);
      }
    })();
  }

  async openR2Object(key: string): Promise<{
    body: Readable;
    size: number;
    contentType: string;
  }> {
    const { client, bucket } = await this.resolveR2();
    if (!client) {
      throw new Error('R2 is not configured');
    }
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!res.Body) {
      throw new Error('Empty R2 object body');
    }
    return {
      body: res.Body as Readable,
      size: Number(res.ContentLength ?? 0),
      contentType: res.ContentType ?? contentTypeForPath(key),
    };
  }

  async deleteR2Reference(ref: string | null | undefined): Promise<void> {
    if (!ref || !isR2Reference(ref)) return;
    await this.deleteFile(fromR2Reference(ref));
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const { client, bucket } = await this.resolveR2();
    if (!client) return this.getLocalPath(key);
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
  }

  async deleteFile(key: string): Promise<void> {
    const { client, bucket } = await this.resolveR2();
    if (client) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    const local = this.getLocalPath(key);
    if (fs.existsSync(local)) fs.unlinkSync(local);
  }

  async getVideoRetentionHours(): Promise<number> {
    const credentials = await this.storageSettings.getCredentials();
    return credentials.videoRetentionHours;
  }

  async cleanupOlderThan(hours?: number): Promise<number> {
    const credentials = await this.storageSettings.getCredentials();
    const retentionHours = hours ?? credentials.videoRetentionHours;
    const tempDir = this.getLocalPath('temp');
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

    walk(tempDir);
    walk(this.getLocalPath('downloads'));
    walk(this.getLocalPath('playlists'));
    walk(this.getLocalPath('thumbnails'));

    removeEmptyDirs(tempDir);
    removeEmptyDirs(this.getLocalPath('downloads'));
    removeEmptyDirs(this.getLocalPath('playlists'));
    removeEmptyDirs(this.getLocalPath('thumbnails'));

    return removed;
  }
}
