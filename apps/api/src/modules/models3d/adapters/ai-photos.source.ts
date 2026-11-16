import { Injectable } from '@nestjs/common';
import { FileStorage } from '../../../infrastructure/storage/file-storage.port.js';
import { AiModelProvider, type ModelJob, ModelProcessingError, ModelSource } from '../ports.js';

/**
 * ADAPTADOR: el modelo se genera con IA a partir de fotos del mueble.
 * No sabe qué proveedor lo hace: se lo pide al puerto AiModelProvider.
 */
@Injectable()
export class AiPhotosSource extends ModelSource {
  readonly kinds = ['ai'] as const;

  constructor(
    private readonly storage: FileStorage,
    private readonly provider: AiModelProvider,
  ) {
    super();
  }

  async fetchOriginal(job: ModelJob): Promise<Buffer> {
    if (!this.provider.enabled) {
      throw new ModelProcessingError('La generación con IA no está configurada.');
    }
    if (job.sourceImages.length === 0) {
      throw new ModelProcessingError('Faltan las fotos para generar el modelo.');
    }
    const images = await Promise.all(
      job.sourceImages.map(async (key) => ({
        data: await this.storage.read(key),
        contentType: 'image/webp',
      })),
    );
    return this.provider.generateFromImages(images);
  }
}
