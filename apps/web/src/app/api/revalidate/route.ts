import { CACHE_TAGS } from '@cva/shared';
import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

const KNOWN_TAGS = new Set<string>(Object.values(CACHE_TAGS));

/**
 * La API llama acá cuando el dueño cambia algo, para que la tienda muestre
 * el dato nuevo sin esperar a que venza la caché. Va protegido con un secreto
 * compartido (REVALIDATE_SECRET, el mismo valor en la web y en la API).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((tag): tag is string => KNOWN_TAGS.has(tag)) : [];
  // expire: 0 → la próxima visita ya trae el dato nuevo (no sirve una copia vieja).
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
  return NextResponse.json({ revalidated: tags });
}
