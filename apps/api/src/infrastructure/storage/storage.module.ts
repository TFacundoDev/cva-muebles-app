import { join } from 'node:path';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Global,
  Module,
  NotFoundException,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { BackupStorage, FileStorage } from './file-storage.port.js';
import { LocalStorage } from './local.storage.js';
import { R2Storage } from './r2.storage.js';

/** Backups apagados: en R2 hace falta un bucket privado aparte. */
class DisabledBackupStorage implements BackupStorage {
  readonly enabled = false;
  async write(): Promise<void> {}
  async remove(): Promise<void> {}
  async list(): Promise<string[]> {
    return [];
  }
}

/** Recibe las subidas "firmadas" cuando el almacenamiento es el disco local. */
@Controller('storage/local')
export class LocalUploadController {
  constructor(private readonly storage: FileStorage) {}

  @Put('upload')
  async upload(
    @Query('key') key: string,
    @Query('type') contentType: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: Request,
  ): Promise<{ ok: true }> {
    if (!(this.storage instanceof LocalStorage)) throw new NotFoundException();
    if (!key || !contentType || !sig || !this.storage.verify(key, contentType, Number(exp), sig)) {
      throw new ForbiddenException('La URL de subida no es válida o ya venció');
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new BadRequestException('No llegó ningún archivo');
    }
    await this.storage.write(key, req.body);
    return { ok: true };
  }
}

/**
 * Acá se elige qué adaptador se enchufa en cada puerto, según el .env.
 * Es el único lugar de la API que conoce las clases concretas.
 */
@Global()
@Module({
  controllers: [LocalUploadController],
  providers: [
    {
      provide: FileStorage,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): FileStorage =>
        env.STORAGE_DRIVER === 'r2'
          ? new R2Storage({
              accountId: env.R2_ACCOUNT_ID,
              accessKeyId: env.R2_ACCESS_KEY_ID,
              secretAccessKey: env.R2_SECRET_ACCESS_KEY,
              bucket: env.R2_BUCKET,
              publicUrl: env.R2_PUBLIC_URL,
            })
          : new LocalStorage({
              dir: env.STORAGE_LOCAL_DIR,
              publicApiUrl: env.PUBLIC_API_URL,
              signingSecret: env.UPLOAD_SIGNING_SECRET,
            }),
    },
    {
      provide: BackupStorage,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): BackupStorage => {
        if (env.STORAGE_DRIVER === 'local') {
          // Carpeta hermana de la pública: no se sirve por HTTP.
          return new LocalStorage({
            dir: join(env.STORAGE_LOCAL_DIR, '..', 'storage-backups'),
            publicApiUrl: '',
            signingSecret: env.UPLOAD_SIGNING_SECRET,
          });
        }
        if (!env.R2_BACKUP_BUCKET) return new DisabledBackupStorage();
        return new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucket: env.R2_BACKUP_BUCKET,
          publicUrl: '',
        });
      },
    },
  ],
  exports: [FileStorage, BackupStorage],
})
export class StorageModule {}
