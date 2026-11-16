import { existsSync } from 'node:fs';
import { Global, Injectable, Module } from '@nestjs/common';
import { z } from 'zod';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const list = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  // URL pública de esta API (se usa para armar links de archivos en modo local).
  PUBLIC_API_URL: z.string().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL'),
  DATABASE_SSL: flag,

  // Orígenes de la web que pueden llamar a la API.
  CORS_ORIGINS: list,
  // Webs a las que se les avisa que regeneren páginas (puede haber más de una: Vercel y Netlify).
  WEB_URLS: list,
  REVALIDATE_SECRET: z.string().default(''),

  // Login: "supabase" en producción, "dev" solo para trabajar en local sin Supabase.
  AUTH_MODE: z.enum(['supabase', 'dev']).default('supabase'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_JWT_SECRET: z.string().default(''),
  OWNER_EMAILS: list.transform((v) => v.map((e) => e.toLowerCase())),

  // Archivos: "r2" en producción, "local" guarda en disco para desarrollo.
  STORAGE_DRIVER: z.enum(['r2', 'local']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  UPLOAD_SIGNING_SECRET: z.string().default('dev-secret-cambiar'),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default(''),
  R2_PUBLIC_URL: z.string().default(''),
  // Bucket privado para los backups. Sin esto, en R2 no se hacen backups.
  R2_BACKUP_BUCKET: z.string().default(''),

  // Tareas programadas (ping a la base y backup). Solo en el servidor principal.
  RUN_JOBS: flag,

  // Generación de modelos con IA.
  AI_PROVIDER: z.enum(['none', 'meshy']).default('none'),
  MESHY_API_KEY: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables de entorno inválidas:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const problems: string[] = [];

  if (env.AUTH_MODE === 'supabase' && !env.SUPABASE_URL) {
    problems.push('AUTH_MODE=supabase necesita SUPABASE_URL');
  }
  if (env.AUTH_MODE === 'dev' && env.NODE_ENV === 'production') {
    problems.push('AUTH_MODE=dev no se puede usar en producción: cualquiera podría entrar como dueño');
  }
  if (env.STORAGE_DRIVER === 'r2') {
    for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'] as const) {
      if (!env[key]) problems.push(`STORAGE_DRIVER=r2 necesita ${key}`);
    }
  }
  if (env.STORAGE_DRIVER === 'local' && env.NODE_ENV === 'production' && env.UPLOAD_SIGNING_SECRET === 'dev-secret-cambiar') {
    problems.push('Cambiá UPLOAD_SIGNING_SECRET en producción');
  }
  if (env.AI_PROVIDER === 'meshy' && !env.MESHY_API_KEY) {
    problems.push('AI_PROVIDER=meshy necesita MESHY_API_KEY');
  }
  if (problems.length) {
    throw new Error(`Configuración incompleta:\n- ${problems.join('\n- ')}`);
  }
  return env;
}

@Injectable()
export class AppConfig {
  readonly env: Env = loadEnv();

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}

@Global()
@Module({ providers: [AppConfig], exports: [AppConfig] })
export class ConfigModule {}
