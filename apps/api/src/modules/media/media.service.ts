import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CACHE_TAGS,
  IMAGE_CONTENT_TYPES,
  type ImageDto,
  MAX_IMAGE_BYTES,
  type MeDto,
  type UploadRequest,
  type UploadTicketDto,
} from '@cva/shared';
import sharp from 'sharp';
import type { ProductImage } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { FileStorage } from '../../infrastructure/storage/file-storage.port.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Carpeta temporal donde cada persona sube sus archivos antes de registrarlos. */
export function uploadPrefix(user: MeDto): string {
  return `uploads/${user.id.replace(/[^a-zA-Z0-9_-]/g, '')}/`;
}

/** Nadie puede registrar un archivo que subió otra persona. */
export function assertOwnUpload(user: MeDto, key: string): void {
  if (!key.startsWith(uploadPrefix(user)) || key.includes('..')) {
    throw new ForbiddenException('Ese archivo no es tuyo');
  }
}

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByProducts(productIds: string[]): Promise<ProductImage[]> {
    return this.prisma.productImage.findMany({
      where: { productId: { in: productIds } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findById(id: string): Promise<ProductImage | null> {
    return this.prisma.productImage.findUnique({ where: { id } });
  }

  count(productId: string): Promise<number> {
    return this.prisma.productImage.count({ where: { productId } });
  }

  create(data: { productId: string; path: string; sortOrder: number }): Promise<ProductImage> {
    return this.prisma.productImage.create({ data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.productImage.delete({ where: { id } });
  }

  async reorder(productId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.productImage.updateMany({ where: { id, productId }, data: { sortOrder: index } }),
      ),
    );
  }
}

/**
 * Fotos: da las URLs firmadas de subida, convierte lo subido a WebP y
 * administra las fotos de cada producto.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: FileStorage,
    private readonly webCache: WebCacheService,
  ) {}

  url(key: string): string {
    return this.storage.publicUrl(key);
  }

  /** Paso 1 de una subida: el navegador pide permiso y sube directo al almacenamiento. */
  createImageUpload(user: MeDto, request: UploadRequest): Promise<UploadTicketDto> {
    const extension = EXTENSIONS[request.contentType];
    if (!extension || !(IMAGE_CONTENT_TYPES as readonly string[]).includes(request.contentType)) {
      throw new BadRequestException('Subí una foto en formato JPG, PNG o WebP');
    }
    if (request.sizeBytes > MAX_IMAGE_BYTES) {
      throw new BadRequestException('La foto pesa demasiado. El máximo es 10 MB');
    }
    return this.storage.createUploadUrl(
      `${uploadPrefix(user)}${randomUUID()}.${extension}`,
      request.contentType,
    );
  }

  /**
   * Paso 2: valida el archivo ya subido, lo convierte a WebP (pesa mucho menos)
   * y lo deja en su carpeta definitiva. Devuelve la clave final.
   */
  async ingestImage(user: MeDto, tempKey: string, destination: string, maxSide = 1600): Promise<string> {
    assertOwnUpload(user, tempKey);
    const info = await this.storage.stat(tempKey);
    if (!info) throw new BadRequestException('No encontramos la foto subida. Probá de nuevo');
    if (info.size > MAX_IMAGE_BYTES) {
      await this.storage.remove(tempKey);
      throw new BadRequestException('La foto pesa demasiado. El máximo es 10 MB');
    }

    const original = await this.storage.read(tempKey);
    let webp: Buffer;
    try {
      webp = await sharp(original)
        .rotate() // respeta la orientación con la que se sacó la foto
        .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      await this.storage.remove(tempKey);
      throw new BadRequestException('El archivo no es una imagen válida');
    }

    const key = `${destination}/${randomUUID()}.webp`;
    await this.storage.write(key, webp, 'image/webp');
    await this.storage.remove(tempKey);
    return key;
  }

  async removeFile(key: string | null | undefined): Promise<void> {
    if (key) await this.storage.remove(key).catch(() => undefined);
  }

  // ---------- Fotos de productos ----------

  async listByProducts(productIds: string[]): Promise<Map<string, ImageDto[]>> {
    const result = new Map<string, ImageDto[]>();
    if (productIds.length === 0) return result;
    for (const row of await this.repository.listByProducts(productIds)) {
      const list = result.get(row.productId) ?? [];
      list.push(this.toDto(row));
      result.set(row.productId, list);
    }
    return result;
  }

  async addProductImage(user: MeDto, productId: string, tempKey: string): Promise<ImageDto> {
    const count = await this.repository.count(productId);
    if (count >= 12) throw new BadRequestException('Un producto puede tener hasta 12 fotos');
    const path = await this.ingestImage(user, tempKey, `products/${productId}`);
    try {
      const row = await this.repository.create({ productId, path, sortOrder: count });
      this.webCache.revalidate(CACHE_TAGS.products);
      return this.toDto(row);
    } catch (error) {
      await this.removeFile(path);
      if ((error as { code?: string }).code === 'P2003') throw new NotFoundException('El producto no existe');
      throw error;
    }
  }

  async removeProductImage(productId: string, imageId: string): Promise<void> {
    const row = await this.repository.findById(imageId);
    if (!row || row.productId !== productId) throw new NotFoundException('La foto no existe');
    await this.repository.delete(imageId);
    await this.removeFile(row.path);
    this.webCache.revalidate(CACHE_TAGS.products);
  }

  async reorderProductImages(productId: string, ids: string[]): Promise<ImageDto[]> {
    await this.repository.reorder(productId, ids);
    this.webCache.revalidate(CACHE_TAGS.products);
    return (await this.listByProducts([productId])).get(productId) ?? [];
  }

  /** Al borrar un producto: borra los archivos (las filas se van en cascada). */
  async removeAllForProduct(productId: string): Promise<void> {
    for (const row of await this.repository.listByProducts([productId])) {
      await this.removeFile(row.path);
    }
  }

  private toDto(row: ProductImage): ImageDto {
    return { id: row.id, url: this.storage.publicUrl(row.path), sortOrder: row.sortOrder };
  }
}
