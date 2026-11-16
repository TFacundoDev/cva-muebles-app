import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ConfigModule } from './config/app-config.js';
import { DatabaseModule } from './infrastructure/database/prisma.service.js';
import { JobsModule } from './infrastructure/jobs/jobs.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { WebCacheModule } from './infrastructure/web-cache/web-cache.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { GalleryModule } from './modules/gallery/gallery.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { Models3dModule } from './modules/models3d/models3d.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { StoreModule } from './modules/store/store.module.js';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Arquitectura mixta, en tres niveles:
 *  1. Módulos por tema (carpeta modules/).
 *  2. Capas adentro de cada módulo: controller -> service -> repository.
 *  3. Puertos y adaptadores solo en el borde con lo externo
 *     (FileStorage, TokenVerifier, ModelSource y AiModelProvider).
 *
 * Quién depende de quién (sin círculos):
 *   gallery -> products -> categories, media, models3d -> media
 */
@Module({
  imports: [
    // Infraestructura compartida
    ConfigModule,
    DatabaseModule,
    StorageModule,
    WebCacheModule,
    ScheduleModule.forRoot(),
    // Límite general: 300 pedidos por minuto por IP. Las lecturas públicas del
    // catálogo no cuentan (las pide el servidor de la web, siempre desde la
    // misma IP) y las subidas tienen un límite propio, más bajo.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // Módulos del negocio
    UsersModule,
    AuthModule,
    StoreModule,
    CategoriesModule,
    MediaModule,
    Models3dModule,
    ProductsModule,
    GalleryModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
