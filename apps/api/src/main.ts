import 'reflect-metadata';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { env } = app.get(AppConfig);

  // Detrás del proxy de Fly/Render: así el límite de pedidos ve la IP real.
  app.set('trust proxy', 1);
  // Las fotos y modelos se muestran desde otro dominio (la web).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  if (env.STORAGE_DRIVER === 'local') {
    // Solo en desarrollo: la API recibe y sirve los archivos desde el disco.
    app.use('/storage/local/upload', express.raw({ type: () => true, limit: '110mb' }));
    app.use('/files', express.static(resolve(env.STORAGE_LOCAL_DIR), { maxAge: '1h' }));
  }

  app.enableShutdownHooks();
  await app.listen(env.PORT, '0.0.0.0');
  new Logger('Inicio').log(
    `API en el puerto ${env.PORT} · login: ${env.AUTH_MODE} · archivos: ${env.STORAGE_DRIVER} · tareas: ${env.RUN_JOBS ? 'sí' : 'no'}`,
  );
}

await bootstrap();
