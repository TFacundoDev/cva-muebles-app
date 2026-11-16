import { Injectable } from '@nestjs/common';
import type { Category } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { slug } });
  }

  findByIds(ids: string[]): Promise<Category[]> {
    return this.prisma.category.findMany({ where: { id: { in: ids } } });
  }

  create(data: { name: string; slug: string; sortOrder: number }): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: Partial<{ name: string; slug: string; sortOrder: number }>): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}
