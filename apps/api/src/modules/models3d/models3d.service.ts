import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import {
  CACHE_TAGS,
  MAX_MODEL_UPLOAD_BYTES,
  type MeDto,
  type ModelAdminDto,
  type ModelPublicDto,
  type ModelStatus,
  type RegisterModel,
  type UploadRequest,
  type UploadTicketDto,
} from '@cva/shared';
import type { Model3d, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { FileStorage } from '../../infrastructure/storage/file-storage.port.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';
import { assertOwnUpload, MediaService, uploadPrefix } from '../media/media.service.js';
import { ModelProcessor, type TargetDimensions } from './model-processor.js';
import { AiModelProvider, MODEL_SOURCE_ADAPTERS, ModelProcessingError, ModelSource } from './ports.js';

@Injectable()
export class Models3dRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProduct(productId: string): Promise<Model3d | null> {
    return this.prisma.model3d.findUnique({ where: { productId } });
  }

  findByProducts(productIds: string[]): Promise<Model3d[]> {
    return this.prisma.model3d.findMany({ where: { productId: { in: productIds } } });
  }

  async productIdsWithModel(): Promise<string[]> {
    const rows = await this.prisma.model3d.findMany({
      where: { glbPath: { not: null } },
      select: { productId: true },
    });
    return rows.map((row) => row.productId);
  }

  findUnfinished(): Promise<Model3d[]> {
    return this.prisma.model3d.findMany({ where: { status: { in: ['pending', 'processing'] } } });
  }

  upsert(productId: string, data: Omit<Prisma.Model3dUncheckedCreateInput, 'productId'>): Promise<Model3d> {
    return this.prisma.model3d.upsert({
      where: { productId },
      create: { ...data, productId },
      update: data,
    });
  }

  update(productId: string, data: Prisma.Model3dUncheckedUpdateInput): Promise<Model3d> {
    return this.prisma.model3d.update({ where: { productId }, data });
  }

  async delete(productId: string): Promise<void> {
    await this.prisma.model3d.deleteMany({ where: { productId } });
  }
}

/**
 * Modelos 3D: recibe el pedido, lo deja en cola y lo procesa en segundo plano.
 * El estado avanza: pendiente -> procesando -> listo (o error).
 */
@Injectable()
export class Models3dService implements OnApplicationBootstrap {
  private readonly logger = new Logger(Models3dService.name);
  // Cola simple: un modelo por vez, para no quedarse sin memoria en un servidor chico.
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: Models3dRepository,
    private readonly storage: FileStorage,
    private readonly media: MediaService,
    private readonly processor: ModelProcessor,
    private readonly webCache: WebCacheService,
    private readonly ai: AiModelProvider,
    @Inject(MODEL_SOURCE_ADAPTERS) private readonly sources: ModelSource[],
  ) {}

  /** Si el servidor se reinició con modelos a medio procesar, los retoma. */
  async onApplicationBootstrap(): Promise<void> {
    for (const row of await this.repository.findUnfinished()) {
      if (row.originalPath || row.sourceImages.length > 0) {
        await this.repository.update(row.productId, { status: 'pending' });
        this.enqueue(row.productId);
      } else {
        await this.repository.update(row.productId, {
          status: 'error',
          error: 'El procesamiento se interrumpió. Volvé a subir el modelo.',
        });
      }
    }
  }

  get aiEnabled(): boolean {
    return this.ai.enabled;
  }

  /** URL firmada para subir el archivo del modelo. */
  createModelUpload(user: MeDto, request: UploadRequest): Promise<UploadTicketDto> {
    if (request.sizeBytes > MAX_MODEL_UPLOAD_BYTES) {
      throw new BadRequestException('El archivo pesa demasiado. El máximo es 100 MB');
    }
    // Los navegadores no siempre reconocen el tipo de un .glb: se guarda como binario genérico.
    return this.storage.createUploadUrl(
      `${uploadPrefix(user)}${randomUUID()}.glb`,
      request.contentType || 'application/octet-stream',
    );
  }

  /** Registra de dónde sale el modelo y lanza el procesamiento. Responde enseguida. */
  async start(
    user: MeDto,
    productId: string,
    target: TargetDimensions,
    input: RegisterModel,
  ): Promise<ModelAdminDto> {
    const previous = await this.repository.findByProduct(productId);
    if (previous && (previous.status === 'pending' || previous.status === 'processing')) {
      throw new BadRequestException('Ya hay un modelo procesándose para este producto. Esperá a que termine');
    }

    let originalPath: string | null = null;
    let sourceImages: string[] = [];
    if (input.source === 'ai') {
      if (!this.ai.enabled) throw new BadRequestException('La generación con IA no está configurada');
      for (const key of input.imageKeys ?? []) {
        sourceImages.push(await this.media.ingestImage(user, key, `models/${productId}/ia`, 1536));
      }
    } else {
      originalPath = input.key!;
      assertOwnUpload(user, originalPath);
      if (!(await this.storage.stat(originalPath))) {
        throw new BadRequestException('No encontramos el archivo subido. Probá de nuevo');
      }
    }

    // Restos de un intento anterior que falló.
    await this.media.removeFile(previous?.originalPath);
    for (const key of previous?.sourceImages ?? []) await this.media.removeFile(key);

    const row = await this.repository.upsert(productId, {
      source: input.source,
      status: 'pending',
      originalPath,
      sourceImages,
      targetWidth: target.widthCm,
      targetDepth: target.depthCm,
      targetHeight: target.heightCm,
      error: null,
      warning: null,
    });
    this.enqueue(productId);
    return this.toAdmin(row);
  }

  private enqueue(productId: string): void {
    this.queue = this.queue
      .then(() => this.process(productId))
      .catch((error: Error) => this.logger.error(`Cola de modelos: ${error.message}`));
  }

  private async process(productId: string): Promise<void> {
    const row = await this.repository.findByProduct(productId);
    if (!row || row.status !== 'pending') return;
    await this.repository.update(productId, { status: 'processing' });

    try {
      const source = this.sources.find((adapter) => adapter.kinds.includes(row.source));
      if (!source) throw new ModelProcessingError('Origen de modelo no soportado.');

      const original = await source.fetchOriginal({
        productId,
        source: row.source,
        originalPath: row.originalPath,
        sourceImages: row.sourceImages,
      });
      const result = await this.processor.process(original, {
        widthCm: row.targetWidth,
        depthCm: row.targetDepth,
        heightCm: row.targetHeight,
      });

      const glbPath = `models/${productId}/${randomUUID()}.glb`;
      await this.storage.write(glbPath, result.glb, 'model/gltf-binary');
      // El modelo anterior se reemplaza recién ahora, con el nuevo ya guardado:
      // la ficha nunca queda sin visor.
      await this.repository.update(productId, {
        status: 'ready',
        glbPath,
        sizeBytes: result.glb.length,
        warning: result.warning,
        error: null,
        posterPath: null,
        originalPath: null,
        sourceImages: [],
      });
      await this.media.removeFile(row.glbPath);
      await this.media.removeFile(row.posterPath);
      await this.media.removeFile(row.originalPath);
      for (const key of row.sourceImages) await this.media.removeFile(key);

      this.webCache.revalidate(CACHE_TAGS.products);
      this.logger.log(`Modelo listo para el producto ${productId} (${result.glb.length} bytes)`);
    } catch (error) {
      const friendly =
        error instanceof ModelProcessingError
          ? error.message
          : 'No se pudo procesar el modelo. Probá de nuevo o subí otro archivo.';
      if (!(error instanceof ModelProcessingError)) {
        this.logger.error(`Falló el modelo de ${productId}: ${(error as Error).stack}`);
      }
      await this.repository.update(productId, { status: 'error', error: friendly });
    }
  }

  /** Foto de carga previa: la saca el panel desde el visor y la sube acá. */
  async setPoster(user: MeDto, productId: string, tempKey: string): Promise<ModelAdminDto> {
    const row = await this.repository.findByProduct(productId);
    if (!row?.glbPath) throw new BadRequestException('El producto todavía no tiene un modelo listo');
    const posterPath = await this.media.ingestImage(user, tempKey, `models/${productId}`, 1200);
    const updated = await this.repository.update(productId, { posterPath });
    await this.media.removeFile(row.posterPath);
    this.webCache.revalidate(CACHE_TAGS.products);
    return this.toAdmin(updated);
  }

  async getAdmin(productId: string): Promise<ModelAdminDto | null> {
    const row = await this.repository.findByProduct(productId);
    return row ? this.toAdmin(row) : null;
  }

  async getAdminOrFail(productId: string): Promise<ModelAdminDto> {
    const dto = await this.getAdmin(productId);
    if (!dto) throw new NotFoundException('El producto no tiene modelo 3D');
    return dto;
  }

  /** Modelos publicados (con .glb listo) de varios productos. */
  async publicByProducts(productIds: string[]): Promise<Map<string, ModelPublicDto>> {
    const result = new Map<string, ModelPublicDto>();
    if (productIds.length === 0) return result;
    for (const row of await this.repository.findByProducts(productIds)) {
      if (!row.glbPath) continue;
      result.set(row.productId, {
        glbUrl: this.storage.publicUrl(row.glbPath),
        posterUrl: row.posterPath ? this.storage.publicUrl(row.posterPath) : null,
        sizeBytes: row.sizeBytes,
      });
    }
    return result;
  }

  async statusByProducts(productIds: string[]): Promise<Map<string, ModelStatus>> {
    if (productIds.length === 0) return new Map();
    const rows = await this.repository.findByProducts(productIds);
    return new Map(rows.map((row) => [row.productId, row.status]));
  }

  productIdsWithModel(): Promise<string[]> {
    return this.repository.productIdsWithModel();
  }

  /** Quita el modelo de un producto (o limpia todo antes de borrar el producto). */
  async removeForProduct(productId: string): Promise<void> {
    const row = await this.repository.findByProduct(productId);
    if (!row) return;
    await this.repository.delete(productId);
    await this.media.removeFile(row.glbPath);
    await this.media.removeFile(row.posterPath);
    await this.media.removeFile(row.originalPath);
    for (const key of row.sourceImages) await this.media.removeFile(key);
    this.webCache.revalidate(CACHE_TAGS.products);
  }

  private toAdmin(row: Model3d): ModelAdminDto {
    return {
      source: row.source,
      status: row.status,
      glbUrl: row.glbPath ? this.storage.publicUrl(row.glbPath) : null,
      posterUrl: row.posterPath ? this.storage.publicUrl(row.posterPath) : null,
      sizeBytes: row.sizeBytes,
      error: row.error,
      warning: row.warning,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
