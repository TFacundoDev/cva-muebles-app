import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CACHE_TAGS,
  type CategoryDto,
  type CategoryInput,
  type CategoryUpdate,
  slugify,
} from '@cva/shared';
import type { Category } from '../../generated/prisma/client.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';
import { CategoriesRepository } from './categories.repository.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repository: CategoriesRepository,
    private readonly webCache: WebCacheService,
  ) {}

  async list(): Promise<CategoryDto[]> {
    return (await this.repository.list()).map(toDto);
  }

  async findBySlug(slug: string): Promise<CategoryDto | null> {
    const row = await this.repository.findBySlug(slug);
    return row ? toDto(row) : null;
  }

  async findByIds(ids: string[]): Promise<Map<string, CategoryDto>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.repository.findByIds(unique);
    return new Map(rows.map((row) => [row.id, toDto(row)]));
  }

  async getOrFail(id: string): Promise<CategoryDto> {
    const row = await this.repository.findById(id);
    if (!row) throw new NotFoundException('La categoría no existe');
    return toDto(row);
  }

  async create(input: CategoryInput): Promise<CategoryDto> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new ConflictException('El nombre no sirve para armar la dirección de la categoría');
    if (await this.repository.findBySlug(slug)) {
      throw new ConflictException('Ya hay una categoría con ese nombre');
    }
    const sortOrder = input.sortOrder ?? (await this.repository.list()).length;
    const row = await this.repository.create({ name: input.name, slug, sortOrder });
    this.webCache.revalidate(CACHE_TAGS.categories);
    return toDto(row);
  }

  async update(id: string, input: CategoryUpdate): Promise<CategoryDto> {
    await this.getOrFail(id);
    if (input.slug) {
      const other = await this.repository.findBySlug(input.slug);
      if (other && other.id !== id) throw new ConflictException('Esa dirección ya la usa otra categoría');
    }
    const row = await this.repository.update(id, input);
    // El nombre y el slug de la categoría también aparecen en cada producto.
    this.webCache.revalidate(CACHE_TAGS.categories, CACHE_TAGS.products);
    return toDto(row);
  }

  async delete(id: string): Promise<void> {
    await this.getOrFail(id);
    try {
      await this.repository.delete(id);
    } catch (error) {
      // La base no deja borrar una categoría que todavía tiene productos.
      if ((error as { code?: string }).code === 'P2003') {
        throw new ConflictException('La categoría tiene productos. Movelos o borralos primero');
      }
      throw error;
    }
    this.webCache.revalidate(CACHE_TAGS.categories);
  }
}

function toDto(row: Category): CategoryDto {
  return { id: row.id, name: row.name, slug: row.slug, sortOrder: row.sortOrder };
}
