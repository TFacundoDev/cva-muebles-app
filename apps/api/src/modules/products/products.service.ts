import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminProductQuery,
  CACHE_TAGS,
  type GalleryProductRef,
  type Paginated,
  type ProductAdminDto,
  type ProductAdminSummaryDto,
  type ProductDetailDto,
  type ProductFacetsDto,
  type ProductInput,
  type ProductQuery,
  type ProductSummaryDto,
  type ProductUpdate,
  slugify,
} from '@cva/shared';
import type { Product } from '../../generated/prisma/client.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';
import { CategoriesService } from '../categories/categories.service.js';
import { MediaService } from '../media/media.service.js';
import type { TargetDimensions } from '../models3d/model-processor.js';
import { Models3dService } from '../models3d/models3d.service.js';
import { ProductsRepository, type ProductWhere } from './products.repository.js';

/**
 * Reglas del catálogo. Para armar una ficha junta datos de otros módulos
 * pidiéndoselos a sus services (categoría, fotos y modelo 3D), nunca
 * leyendo sus tablas.
 */
@Injectable()
export class ProductsService {
  constructor(
    private readonly repository: ProductsRepository,
    private readonly categories: CategoriesService,
    private readonly media: MediaService,
    private readonly models: Models3dService,
    private readonly webCache: WebCacheService,
  ) {}

  // ---------- Público: solo productos publicados ----------

  async list(query: ProductQuery): Promise<Paginated<ProductSummaryDto>> {
    const empty = { items: [], total: 0, page: query.page, pageSize: query.pageSize };
    const where: ProductWhere = { status: 'published' };

    if (query.category) {
      const category = await this.categories.findBySlug(query.category);
      if (!category) return empty;
      where.categoryId = category.id;
    }
    if (query.wood) where.woods = { has: query.wood };
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    if (query.featured) where.featured = true;
    if (query.with3d) where.id = { in: await this.models.productIdsWithModel() };

    const { rows, total } = await this.repository.findPage(where, query.page, query.pageSize);
    return { items: await this.toSummaries(rows), total, page: query.page, pageSize: query.pageSize };
  }

  async detailBySlug(slug: string): Promise<ProductDetailDto> {
    const row = await this.repository.findBySlug(slug);
    if (!row || row.status !== 'published') throw new NotFoundException('El mueble no existe');
    return this.toDetail(row);
  }

  async facets(): Promise<ProductFacetsDto> {
    return { woods: await this.repository.publishedWoods() };
  }

  // ---------- Para otros módulos ----------

  /** Datos mínimos de productos publicados, para enlazar fotos de la galería. */
  async refs(ids: string[]): Promise<Map<string, GalleryProductRef>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.repository.findMany({ id: { in: unique }, status: 'published' });
    const categories = await this.categories.findByIds(rows.map((row) => row.categoryId));
    return new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          slug: row.slug,
          categorySlug: categories.get(row.categoryId)?.slug ?? '',
        },
      ]),
    );
  }

  async publishedIdsByCategorySlug(slug: string): Promise<string[]> {
    const category = await this.categories.findBySlug(slug);
    if (!category) return [];
    const rows = await this.repository.findMany({ categoryId: category.id, status: 'published' });
    return rows.map((row) => row.id);
  }

  async isPublished(id: string): Promise<boolean> {
    const row = await this.repository.findById(id);
    return row?.status === 'published';
  }

  async dimensions(id: string): Promise<TargetDimensions> {
    const row = await this.getRowOrFail(id);
    return { widthCm: row.widthCm, depthCm: row.depthCm, heightCm: row.heightCm };
  }

  // ---------- Panel del dueño ----------

  async adminList(query: AdminProductQuery): Promise<Paginated<ProductAdminSummaryDto>> {
    const where: ProductWhere = {};
    if (query.status) where.status = query.status;
    if (query.q) where.name = { contains: query.q, mode: 'insensitive' };
    const { rows, total } = await this.repository.findPage(where, query.page, query.pageSize);
    const summaries = await this.toSummaries(rows);
    const statuses = await this.models.statusByProducts(rows.map((row) => row.id));
    return {
      items: summaries.map((summary, index) => ({
        ...summary,
        modelStatus: statuses.get(summary.id) ?? null,
        updatedAt: rows[index].updatedAt.toISOString(),
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async adminGet(id: string): Promise<ProductAdminDto> {
    const row = await this.getRowOrFail(id);
    return {
      ...(await this.toDetail(row)),
      modelAdmin: await this.models.getAdmin(id),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(input: ProductInput): Promise<ProductAdminDto> {
    await this.categories.getOrFail(input.categoryId);
    const slug = await this.freeSlug(input.slug ?? slugify(input.name));
    const row = await this.repository.create({ ...input, slug });
    this.webCache.revalidate(CACHE_TAGS.products);
    return this.adminGet(row.id);
  }

  async update(id: string, input: ProductUpdate): Promise<ProductAdminDto> {
    const current = await this.getRowOrFail(id);
    if (input.categoryId) await this.categories.getOrFail(input.categoryId);
    if (input.slug && input.slug !== current.slug) {
      const other = await this.repository.findBySlug(input.slug);
      if (other) throw new ConflictException('Esa dirección ya la usa otro producto');
    }
    await this.repository.update(id, input);
    this.webCache.revalidate(CACHE_TAGS.products, CACHE_TAGS.gallery);
    return this.adminGet(id);
  }

  async delete(id: string): Promise<void> {
    await this.getRowOrFail(id);
    // Primero los archivos; las filas de fotos y modelo se van en cascada.
    await this.media.removeAllForProduct(id);
    await this.models.removeForProduct(id);
    await this.repository.delete(id);
    this.webCache.revalidate(CACHE_TAGS.products, CACHE_TAGS.gallery);
  }

  // ---------- Internos ----------

  private async getRowOrFail(id: string): Promise<Product> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('El producto no existe');
    return row;
  }

  /** Si el slug ya existe le agrega -2, -3... */
  private async freeSlug(base: string): Promise<string> {
    if (!base) throw new ConflictException('El nombre no sirve para armar la dirección del producto');
    let slug = base;
    for (let n = 2; await this.repository.findBySlug(slug); n++) slug = `${base}-${n}`;
    return slug;
  }

  private async toSummaries(rows: Product[]): Promise<ProductSummaryDto[]> {
    const ids = rows.map((row) => row.id);
    const [categories, images, models] = await Promise.all([
      this.categories.findByIds(rows.map((row) => row.categoryId)),
      this.media.listByProducts(ids),
      this.models.publicByProducts(ids),
    ]);
    return rows.map((row) => {
      const category = categories.get(row.categoryId);
      const model = models.get(row.id);
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: {
          id: row.categoryId,
          name: category?.name ?? '',
          slug: category?.slug ?? '',
        },
        price: row.price == null ? null : Number(row.price),
        // Portada: la primera foto; si no hay, la captura del modelo 3D.
        coverUrl: images.get(row.id)?.[0]?.url ?? model?.posterUrl ?? null,
        has3d: !!model,
        woods: row.woods,
        featured: row.featured,
        status: row.status,
      };
    });
  }

  private async toDetail(row: Product): Promise<ProductDetailDto> {
    const [summary] = await this.toSummaries([row]);
    const [images, models] = await Promise.all([
      this.media.listByProducts([row.id]),
      this.models.publicByProducts([row.id]),
    ]);
    return {
      ...summary,
      description: row.description,
      widthCm: row.widthCm,
      depthCm: row.depthCm,
      heightCm: row.heightCm,
      materials: row.materials,
      images: images.get(row.id) ?? [],
      model: models.get(row.id) ?? null,
    };
  }
}
