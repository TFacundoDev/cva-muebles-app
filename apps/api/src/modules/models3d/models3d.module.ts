import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { MediaModule } from '../media/media.module.js';
import { AiPhotosSource } from './adapters/ai-photos.source.js';
import { DisabledAiProvider, MeshyProvider } from './adapters/meshy.provider.js';
import { UploadedFileSource } from './adapters/uploaded-file.source.js';
import { ModelProcessor } from './model-processor.js';
import { Models3dRepository, Models3dService } from './models3d.service.js';
import { AiModelProvider, MODEL_SOURCE_ADAPTERS, type ModelSource } from './ports.js';

// Los endpoints /admin/products/:id/model están en el módulo products
// (ProductModelsController): necesitan las medidas del producto, y así
// models3d no depende de products y no se arma un círculo entre módulos.
@Module({
  imports: [MediaModule],
  providers: [
    Models3dRepository,
    Models3dService,
    ModelProcessor,
    UploadedFileSource,
    AiPhotosSource,
    {
      // Qué proveedor de IA se enchufa en el puerto, según el .env.
      provide: AiModelProvider,
      inject: [AppConfig],
      useFactory: ({ env }: AppConfig): AiModelProvider =>
        env.AI_PROVIDER === 'meshy' ? new MeshyProvider(env.MESHY_API_KEY) : new DisabledAiProvider(),
    },
    {
      // Todos los orígenes de modelo disponibles. Sumar uno es agregarlo acá.
      provide: MODEL_SOURCE_ADAPTERS,
      inject: [UploadedFileSource, AiPhotosSource],
      useFactory: (...adapters: ModelSource[]): ModelSource[] => adapters,
    },
  ],
  exports: [Models3dService],
})
export class Models3dModule {}
