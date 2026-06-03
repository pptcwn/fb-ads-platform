import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, unlinkSync } from 'fs';

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || 'auto';

    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
      this.bucket = bucket;
      this.publicBaseUrl = (process.env.S3_PUBLIC_URL || `${endpoint.replace(/\/$/, '')}/${bucket}`).replace(/\/$/, '');
      this.logger.log(`Object storage enabled (bucket: ${bucket})`);
    } else {
      this.client = null;
      this.bucket = '';
      this.publicBaseUrl = '';
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async uploadLocalFile(
    localPath: string,
    key: string,
    contentType: string,
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Object storage is not configured');
    }
    const body = readFileSync(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    try {
      unlinkSync(localPath);
    } catch {
      // non-fatal if temp file remains
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: any) {
      this.logger.warn(`Failed to delete object ${key}: ${err.message}`);
    }
  }
}