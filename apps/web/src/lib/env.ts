const clean = (value: string | undefined, fallback: string) => (value || fallback).replace(/\/$/, '');

/** URL de la API vista desde el navegador. */
export const PUBLIC_API_URL = clean(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:3001');

/** URL de la API vista desde el servidor de Next (por defecto, la misma). */
export const SERVER_API_URL = clean(process.env.API_URL, PUBLIC_API_URL);

/** Dominio público de la tienda: se usa en los links de WhatsApp y al compartir. */
export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000');

/** "dev" permite entrar sin Supabase mientras se desarrolla en local. */
export const AUTH_MODE: 'supabase' | 'dev' =
  process.env.NEXT_PUBLIC_AUTH_MODE === 'dev' ? 'dev' : 'supabase';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
