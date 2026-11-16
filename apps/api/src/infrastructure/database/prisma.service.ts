import { Global, Injectable, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppConfig } from '../../config/app-config.js';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Prisma se usa directo dentro de cada repository, sin puerto en el medio:
 * la base no va a cambiar y una interfaz acá sumaría código sin dar nada.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.env.DATABASE_URL,
        // El pooler de Supabase usa un certificado propio: se cifra sin validar la cadena.
        ssl: config.env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
        max: 5, // el plan gratis de Supabase tiene pocas conexiones
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
