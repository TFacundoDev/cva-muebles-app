import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { UploadTicketDto } from '@cva/shared';
import { assertSafeKey, type BackupStorage, type FileStorage } from './file-storage.port.js';

export interface R2Options {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

/** ADAPTADOR: Cloudflare R2, que habla el mismo protocolo que S3. */
export class R2Storage implements FileStorage, BackupStorage {
  readonly enabled = true;
  private readonly client: S3Client;

  constructor(private readonly options: R2Options) {
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
      // Por defecto el SDK agrega a las URLs firmadas una suma de control
      // calculada sobre un cuerpo vacío, y la subida real desde el navegador
      // falla. Con esto solo la agrega cuando la operación la exige.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async createUploadUrl(key: string, contentType: string): Promise<UploadTicketDto> {
    assertSafeKey(key);
    const command = new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 });
    return { key, uploadUrl, method: 'PUT', headers: { 'Content-Type': contentType } };
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      return { size: head.ContentLength ?? 0 };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  async read(key: string): Promise<Buffer> {
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
    );
    if (!object.Body) throw new Error(`Archivo vacío: ${key}`);
    return Buffer.from(await object.Body.transformToByteArray());
  }

  async write(key: string, data: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // Los archivos finales llevan un id único en el nombre: se pueden cachear para siempre.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  async list(prefix: string): Promise<string[]> {
    const result = await this.client.send(
      new ListObjectsV2Command({ Bucket: this.options.bucket, Prefix: prefix }),
    );
    return (result.Contents ?? []).map((o) => o.Key).filter((k): k is string => !!k);
  }

  publicUrl(key: string): string {
    return `${this.options.publicUrl.replace(/\/$/, '')}/${key}`;
  }
}
