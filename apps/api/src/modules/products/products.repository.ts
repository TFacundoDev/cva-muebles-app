import { Injectable } from '@nestjs/common';
import type { Prisma, Product } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

export type ProductWhere = Prisma.ProductWhereInput;
export type ProductData = Omit<Prisma.ProductUncheckedCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

/** Lo único que habla con la tabla products. */
@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(where: ProductWhere, page: number, pageSize: number): Promise<{ rows: Product[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { rows, total };
  }

  findMany(where: ProductWhere): Promise<Product[]> {
    return this.prisma.product.findMany({ where });
  }

  findById(id: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<Product | null> {
    return this.prisma.product.findUnique({ where: { slug } });
  }

  async publishedWoods(): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: 'published' },
      select: { woods: true },
    });
    return [...new Set(rows.flatMap((row) => row.woods))].sort((a, b) => a.localeCompare(b, 'es'));
  }

  create(data: ProductData): Promise<Product> {
    return this.prisma.product.create({ data });
  }

  update(id: string, data: Partial<ProductData>): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }
}
