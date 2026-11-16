import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 ya no lee el .env solo: lo cargamos acá para los comandos de la CLI.
if (existsSync('.env')) process.loadEnvFile('.env');

// Las migraciones usan DIRECT_URL si existe (en Supabase, el pooler en modo sesión).
// La app, en cambio, se conecta con DATABASE_URL (ver PrismaService).
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/cva_muebles';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url },
});
