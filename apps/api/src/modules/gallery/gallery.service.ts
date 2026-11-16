import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type AdminGalleryQuery,
  CACHE_TAGS,
  type GalleryAdminDto,
  type GalleryCountsDto,
  type GalleryCreate,
  type GalleryMineDto,
  type GalleryModerate,
  type GalleryPostDto,
  type GalleryQuery,
  GALLERY_STATUSES,
  type GalleryStatus,
  MAX_PENDING_GALLERY_POSTS,
  type MeDto,
  type Paginated,
  type UploadRequest,
  type UploadTicketDto,
  type UserAdminDto,
} from '@cva/shared';
import type { GalleryPost, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';
import { MediaService } from '../media/media.service.js';
import { ProductsService } from '../products/products.service.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class GalleryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    where: Prisma.GalleryPostWhereInput,
    page: number,
    pageSize: number,
  ): Promise<{ rows: GalleryPost[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.galleryPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.galleryPost.count({ where }),
    ]);
    return { rows, total };
  }

  findById(id: string): Promise<GalleryPost | null> {
    return this.prisma.galleryPost.findUnique({ where: { id } });
  }

  count(where: Prisma.GalleryPostWhereInput): Promise<number> {
    return this.prisma.galleryPost.count({ where });
  }

  async countByStatus(): Promise<GalleryCountsDto> {
    const groups = await this.prisma.galleryPost.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(GALLERY_STATUSES.map((s) => [s, 0])) as GalleryCountsDto;
    for (const group of groups) counts[group.status] = group._count._all;
    return counts;
  }

  async countByUser(): Promise<Map<string, number>> {
    const groups = await this.prisma.galleryPost.groupBy({ by: ['userId'], _count: { _all: true } });
    return new Map(groups.map((group) => [group.userId, group._count._all]));
  }

  create(data: { userId: string; productId: string; imagePath: string; caption: string }): Promise<GalleryPost> {
    return this.prisma.galleryPost.create({ data });
  }

  setStatus(id: string, status: GalleryStatus): Promise<GalleryPost> {
    return this.prisma.galleryPost.update({ where: { id }, data: { status, moderatedAt: new Date() } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.galleryPost.delete({ where: { id } });
  }
}

/**
 * Galería de clientes. Regla central: nada se publica sin que el dueño lo
 * apruebe. Toda foto nueva entra como "pendiente".
 */
@Injectable()
export class GalleryService {
  constructor(
    private readonly repository: GalleryRepository,
    private readonly media: MediaService,
    private readonly products: ProductsService,
    private readonly users: UsersService,
    private readonly webCache: WebCacheService,
  ) {}

  // ---------- Público ----------

  async listApproved(query: GalleryQuery): Promise<Paginated<GalleryPostDto>> {
    const where: Prisma.GalleryPostWhereInput = { status: 'approved' };
    if (query.productId) where.productId = query.productId;
    if (query.category) {
      where.productId = { in: await this.products.publishedIdsByCategorySlug(query.category) };
    }
    const { rows, total } = await this.repository.findPage(where, query.page, query.pageSize);
    return { items: await this.toDtos(rows), total, page: query.page, pageSize: query.pageSize };
  }

  // ---------- Cliente con cuenta ----------

  createUpload(user: MeDto, request: UploadRequest): Promise<UploadTicketDto> {
    return this.media.createImageUpload(user, request);
  }

  async create(user: MeDto, input: GalleryCreate): Promise<GalleryMineDto> {
    if (!(await this.products.isPublished(input.productId))) {
      throw new BadRequestException('Ese mueble no está en el catálogo');
    }
    // Freno al spam: un tope de fotos esperando revisión por persona.
    const pending = await this.repository.count({ userId: user.id, status: 'pending' });
    if (pending >= MAX_PENDING_GALLERY_POSTS) {
      throw new BadRequestException(
        `Ya tenés ${pending} fotos esperando revisión. Cuando las revisemos vas a poder subir más`,
      );
    }
    const imagePath = await this.media.ingestImage(user, input.key, 'gallery');
    const row = await this.repository.create({
      userId: user.id,
      productId: input.productId,
      imagePath,
      caption: input.caption,
    });
    const [dto] = await this.toDtos([row]);
    return { ...dto, status: row.status };
  }

  async listMine(user: MeDto): Promise<GalleryMineDto[]> {
    const { rows } = await this.repository.findPage({ userId: user.id }, 1, 50);
    const dtos = await this.toDtos(rows);
    return dtos.map((dto, index) => ({ ...dto, status: rows[index].status }));
  }

  // ---------- Dueño ----------

  async adminList(query: AdminGalleryQuery): Promise<Paginated<GalleryAdminDto>> {
    const { rows, total } = await this.repository.findPage(
      { status: query.status },
      query.page,
      query.pageSize,
    );
    const dtos = await this.toDtos(rows);
    const authors = await this.users.findByIds(rows.map((row) => row.userId));
    return {
      items: dtos.map((dto, index) => ({
        ...dto,
        status: rows[index].status,
        authorEmail: authors.get(rows[index].userId)?.email ?? '',
        moderatedAt: rows[index].moderatedAt?.toISOString() ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  counts(): Promise<GalleryCountsDto> {
    return this.repository.countByStatus();
  }

  async moderate(id: string, input: GalleryModerate): Promise<void> {
    await this.getOrFail(id);
    await this.repository.setStatus(id, input.status);
    this.webCache.revalidate(CACHE_TAGS.gallery);
  }

  async delete(id: string): Promise<void> {
    const row = await this.getOrFail(id);
    await this.repository.delete(id);
    await this.media.removeFile(row.imagePath);
    this.webCache.revalidate(CACHE_TAGS.gallery);
  }

  /** Lista de usuarios para el panel, con cuántas fotos subió cada uno. */
  async usersWithCounts(): Promise<UserAdminDto[]> {
    const [users, counts] = await Promise.all([this.users.list(), this.repository.countByUser()]);
    return users.map((user) => ({ ...user, galleryPosts: counts.get(user.id) ?? 0 }));
  }

  // ---------- Internos ----------

  private async getOrFail(id: string): Promise<GalleryPost> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('La foto no existe');
    return row;
  }

  private async toDtos(rows: GalleryPost[]): Promise<GalleryPostDto[]> {
    const productIds = rows.map((row) => row.productId).filter((id): id is string => !!id);
    const [products, authors] = await Promise.all([
      this.products.refs(productIds),
      this.users.findByIds(rows.map((row) => row.userId)),
    ]);
    return rows.map((row) => ({
      id: row.id,
      imageUrl: this.media.url(row.imagePath),
      caption: row.caption,
      // Solo el primer nombre: no hace falta mostrar el apellido de un cliente.
      authorName: (authors.get(row.userId)?.displayName ?? 'Cliente').split(' ')[0],
      product: row.productId ? (products.get(row.productId) ?? null) : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
