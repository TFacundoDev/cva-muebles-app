import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { Controller, Get, HttpCode, Injectable, Logger, Module, Post, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfig } from '../../config/app-config.js';
import { AuthGuard, OwnerGuard } from '../../modules/auth/auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { BackupStorage } from '../storage/file-storage.port.js';

const gzipAsync = promisify(gzip);
const BACKUPS_TO_KEEP = 8;

/**
 * Tareas programadas. Corren dentro de la API y solo si RUN_JOBS=true:
 * en el servidor de respaldo (Render) va en false para que no se dupliquen.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backups: BackupStorage,
    private readonly config: AppConfig,
  ) {}

  /**
   * Supabase pausa los proyectos gratis tras 7 días sin actividad.
   * Una consulta cada 3 días (a las 09:00 UTC) alcanza para que no pase.
   */
  @Cron('0 9 */3 * *')
  async keepDatabaseAwake(): Promise<void> {
    if (!this.config.env.RUN_JOBS) return;
    try {
      const products = await this.prisma.product.count();
      this.logger.log(`Ping a la base: ${products} productos`);
    } catch (error) {
      this.logger.error(`Falló el ping a la base: ${(error as Error).message}`);
    }
  }

  /** Backup semanal: domingos a las 06:00 UTC. */
  @Cron('0 6 * * 0')
  async weeklyBackup(): Promise<void> {
    if (!this.config.env.RUN_JOBS) return;
    try {
      await this.backupNow();
    } catch (error) {
      this.logger.error(`Falló el backup: ${(error as Error).message}`);
    }
  }

  /**
   * Exporta todas las tablas a un JSON comprimido y lo guarda en el
   * almacenamiento privado. Reemplaza los backups automáticos que Supabase
   * solo da en el plan pago. Devuelve el nombre del archivo, o null si los
   * backups están apagados.
   */
  async backupNow(): Promise<string | null> {
    if (!this.backups.enabled) {
      this.logger.warn('Backups apagados: falta configurar R2_BACKUP_BUCKET');
      return null;
    }
    const [categories, products, productImages, models3d, profiles, galleryPosts, settings] =
      await Promise.all([
        this.prisma.category.findMany(),
        this.prisma.product.findMany(),
        this.prisma.productImage.findMany(),
        this.prisma.model3d.findMany(),
        this.prisma.profile.findMany(),
        this.prisma.galleryPost.findMany(),
        this.prisma.setting.findMany(),
      ]);
    const dump = {
      createdAt: new Date().toISOString(),
      tables: { categories, products, productImages, models3d, profiles, galleryPosts, settings },
    };
    const key = `backups/cva-${dump.createdAt.replace(/[:.]/g, '-')}.json.gz`;
    await this.backups.write(key, await gzipAsync(JSON.stringify(dump)), 'application/gzip');

    // Se guardan solo los últimos: los nombres llevan la fecha, así que ordenan solos.
    const existing = (await this.backups.list('backups/')).sort();
    for (const old of existing.slice(0, Math.max(0, existing.length - BACKUPS_TO_KEEP))) {
      await this.backups.remove(old);
    }
    this.logger.log(`Backup guardado: ${key}`);
    return key;
  }
}

@Controller()
export class OpsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
  ) {}

  /** Para los health checks de Fly, Render y el monitor de caídas. */
  @Get('health')
  @SkipThrottle()
  async health(): Promise<{ status: 'ok'; database: boolean }> {
    let database = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = false;
    }
    return { status: 'ok', database };
  }

  /** Backup manual desde el panel. */
  @Post('admin/backup')
  @HttpCode(200)
  @UseGuards(AuthGuard, OwnerGuard)
  async backup(): Promise<{ file: string | null }> {
    return { file: await this.jobs.backupNow() };
  }
}

@Module({
  controllers: [OpsController],
  providers: [JobsService],
})
export class JobsModule {}
