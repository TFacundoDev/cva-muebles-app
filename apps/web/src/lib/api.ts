import {
  CACHE_TAGS,
  type CacheTag,
  type CategoryDto,
  DEFAULT_SETTINGS,
  type GalleryPostDto,
  type Paginated,
  type ProductDetailDto,
  type ProductFacetsDto,
  type ProductSummaryDto,
  type StoreSettings,
} from '@cva/shared';
import { SERVER_API_URL } from './env';

// Lecturas de la API desde el servidor de Next, para la tienda pública.
//
// Cada respuesta queda en caché con una etiqueta. Cuando el dueño cambia algo,
// la API llama a /api/revalidate con esa etiqueta y la próxima visita ya ve
// el dato nuevo. Si ese aviso se pierde, la caché igual vence a los 5 minutos.
const REVALIDATE_SECONDS = 300;

class ApiDownError extends Error {}

async function read<T>(path: string, tags: CacheTag[]): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${SERVER_API_URL}${path}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags },
    });
  } catch {
    throw new ApiDownError(`La API no responde (${path})`);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiDownError(`La API respondió ${response.status} (${path})`);
  return (await response.json()) as T;
}

/** Para listas: si la API está caída se muestra la página vacía en vez de romperla. */
async function readOr<T>(path: string, tags: CacheTag[], fallback: T): Promise<T> {
  try {
    return (await read<T>(path, tags)) ?? fallback;
  } catch (error) {
    console.error((error as Error).message);
    return fallback;
  }
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

const emptyPage = <T>(): Paginated<T> => ({ items: [], total: 0, page: 1, pageSize: 24 });

export function getSettings(): Promise<StoreSettings> {
  return readOr('/settings/public', [CACHE_TAGS.settings], DEFAULT_SETTINGS);
}

export function getCategories(): Promise<CategoryDto[]> {
  return readOr('/categories', [CACHE_TAGS.categories], []);
}

export interface ProductFilters {
  category?: string;
  wood?: string;
  q?: string;
  featured?: boolean;
  with3d?: boolean;
  page?: number;
  pageSize?: number;
}

export function getProducts(filters: ProductFilters = {}): Promise<Paginated<ProductSummaryDto>> {
  return readOr(`/products${toQuery({ ...filters })}`, [CACHE_TAGS.products], emptyPage());
}

export function getFacets(): Promise<ProductFacetsDto> {
  return readOr('/products/facets', [CACHE_TAGS.products], { woods: [] });
}

/** Devuelve null si el mueble no existe. Si la API está caída, lanza el error. */
export function getProduct(slug: string): Promise<ProductDetailDto | null> {
  return read(`/products/${encodeURIComponent(slug)}`, [CACHE_TAGS.products]);
}

export function getGallery(
  filters: { productId?: string; category?: string; page?: number; pageSize?: number } = {},
): Promise<Paginated<GalleryPostDto>> {
  return readOr(`/gallery${toQuery(filters)}`, [CACHE_TAGS.gallery, CACHE_TAGS.products], emptyPage());
}
