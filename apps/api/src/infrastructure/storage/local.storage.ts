import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { UploadTicketDto } from '@cva/shared';
import { assertSafeKey, type BackupStorage, type FileStorage } from './file-storage.port.js';

export interface LocalOptions {
  dir: string;
  publicApiUrl: string;
  signingSecret: string;
}

/**
 * ADAPTADOR: disco local, para desarrollar sin cuenta de R2.
 * Imita las URLs firmadas: la subida va a un endpoint de la propia API
 * (LocalUploadController) que verifica la firma antes de guardar.
 */
export class LocalStorage implements FileStorage, BackupStorage {
  readonly enabled = true;
  readonly root: string;

  constructor(private readonly options: LocalOptions) {
    this.root = resolve(options.dir);
  }

  private path(key: string): string {
    assertSafeKey(key);
    return join(this.root, key);
  }

  sign(key: string, contentType: string, expires: number): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${key}\n${contentType}\n${expires}`)
      .digest('hex');
  }

  verify(key: string, contentType: string, expires: number, signature: string): boolean {
    if (!Number.isFinite(expires) || expires < Date.now()) return false;
    const expected = Buffer.from(this.sign(key, contentType, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  async createUploadUrl(key: string, contentType: string): Promise<UploadTicketDto> {
    assertSafeKey(key);
    const expires = Date.now() + 10 * 60 * 1000;
    const params = new URLSearchParams({
      key,
      type: contentType,
      exp: String(expires),
      sig: this.sign(key, contentType, expires),
    });
    return {
      key,
      uploadUrl: `${this.options.publicApiUrl}/storage/local/upload?${params}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
    };
  }

  async stat(key: string): Promise<{ size: number } | null> {
    try {
      const info = await stat(this.path(key));
      return { size: info.size };
    } catch {
      return null;
    }
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async write(key: string, data: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async list(prefix: string): Promise<string[]> {
    const dir = dirname(join(this.root, `${prefix}x`));
    try {
      const names = await readdir(dir);
      const base = prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/') + 1) : '';
      return names.map((n) => `${base}${n}`).filter((k) => k.startsWith(prefix));
    } catch {
      return [];
    }
  }

  publicUrl(key: string): string {
    return `${this.options.publicApiUrl}/files/${key}`;
  }
}
