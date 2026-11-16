import { Body, Controller, Get, Injectable, Module, Patch, UseGuards } from '@nestjs/common';
import {
  CACHE_TAGS,
  DEFAULT_SETTINGS,
  type SettingsUpdate,
  settingsUpdateSchema,
  type StoreSettings,
} from '@cva/shared';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodPipe } from '../../common/zod.pipe.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { WebCacheService } from '../../infrastructure/web-cache/web-cache.service.js';
import { AuthGuard, OwnerGuard } from '../auth/auth.guard.js';

@Injectable()
export class StoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async all(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async saveMany(values: Record<string, string>): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(values).map(([key, value]) =>
        this.prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } }),
      ),
    );
  }
}

/** Datos del local: nombre, dirección, horarios, mapa y WhatsApp. */
@Injectable()
export class StoreService {
  constructor(
    private readonly repository: StoreRepository,
    private readonly webCache: WebCacheService,
  ) {}

  async get(): Promise<StoreSettings> {
    const stored = await this.repository.all();
    const settings = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[]) {
      if (stored[key] !== undefined) settings[key] = stored[key];
    }
    return settings;
  }

  async update(changes: SettingsUpdate): Promise<StoreSettings> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    if (entries.length) await this.repository.saveMany(Object.fromEntries(entries) as Record<string, string>);
    this.webCache.revalidate(CACHE_TAGS.settings);
    return this.get();
  }
}

@Controller()
export class StoreController {
  constructor(private readonly service: StoreService) {}

  @Get('settings/public')
  @SkipThrottle()
  get(): Promise<StoreSettings> {
    return this.service.get();
  }

  @Patch('admin/settings')
  @UseGuards(AuthGuard, OwnerGuard)
  update(@Body(new ZodPipe(settingsUpdateSchema)) body: SettingsUpdate): Promise<StoreSettings> {
    return this.service.update(body);
  }
}

@Module({
  controllers: [StoreController],
  providers: [StoreRepository, StoreService],
  exports: [StoreService],
})
export class StoreModule {}
