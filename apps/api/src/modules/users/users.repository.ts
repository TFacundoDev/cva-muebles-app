import { Injectable } from '@nestjs/common';
import type { Role } from '@cva/shared';
import type { Profile } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  findByIds(userIds: string[]): Promise<Profile[]> {
    return this.prisma.profile.findMany({ where: { userId: { in: userIds } } });
  }

  list(): Promise<Profile[]> {
    return this.prisma.profile.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
  }

  upsert(data: { userId: string; email: string; displayName: string; role: Role }): Promise<Profile> {
    return this.prisma.profile.upsert({
      where: { userId: data.userId },
      create: data,
      update: { email: data.email, role: data.role },
    });
  }
}
