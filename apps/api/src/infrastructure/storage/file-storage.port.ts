import type { UploadTicketDto } from '@cva/shared';

/**
 * PUERTO: dónde se guardan las fotos y los modelos.
 *
 * Los services dependen de esta clase abstracta y nunca de R2 ni del disco.
 * Cambiar de proveedor es escribir otro adaptador y enchufarlo en StorageModule.
 */
export abstract class FileStorage {
  /** URL firmada para que el navegador suba el archivo directo, sin pasar por la API. */
  abstract createUploadUrl(key: string, contentType: string): Promise<UploadTicketDto>;
  /** Tamaño del archivo, o null si no existe. */
  abstract stat(key: string): Promise<{ size: number } | null>;
  abstract read(key: string): Promise<Buffer>;
  abstract write(key: string, data: Buffer, contentType: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
  abstract list(prefix: string): Promise<string[]>;
  /** URL pública con la que la web muestra el archivo. */
  abstract publicUrl(key: string): string;
}

/** Segundo almacenamiento, privado, solo para backups. */
export abstract class BackupStorage {
  abstract readonly enabled: boolean;
  abstract write(key: string, data: Buffer, contentType: string): Promise<void>;
  abstract remove(key: string): Promise<void>;
  abstract list(prefix: string): Promise<string[]>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_.-]+$/;

export function assertSafeKey(key: string): void {
  if (!SAFE_KEY.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error(`Clave de archivo inválida: ${key}`);
  }
}
