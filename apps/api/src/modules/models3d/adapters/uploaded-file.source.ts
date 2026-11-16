import { Injectable } from '@nestjs/common';
import { MAX_MODEL_UPLOAD_BYTES } from '@cva/shared';
import { FileStorage } from '../../../infrastructure/storage/file-storage.port.js';
import { type ModelJob, ModelProcessingError, ModelSource } from '../ports.js';

/**
 * ADAPTADOR: el modelo ya es un archivo .glb que alguien subió.
 * Sirve para tres orígenes que técnicamente llegan igual: un archivo propio,
 * un escaneo exportado desde el celular y un modelado hecho a medida.
 */
@Injectable()
export class UploadedFileSource extends ModelSource {
  readonly kinds = ['upload', 'scan', 'custom'] as const;

  constructor(private readonly storage: FileStorage) {
    super();
  }

  async fetchOriginal(job: ModelJob): Promise<Buffer> {
    if (!job.originalPath) throw new ModelProcessingError('No se encontró el archivo subido.');
    const info = await this.storage.stat(job.originalPath);
    if (!info) throw new ModelProcessingError('No se encontró el archivo subido. Volvé a subirlo.');
    if (info.size > MAX_MODEL_UPLOAD_BYTES) {
      throw new ModelProcessingError('El archivo pesa demasiado. El máximo es 100 MB.');
    }
    return this.storage.read(job.originalPath);
  }
}
