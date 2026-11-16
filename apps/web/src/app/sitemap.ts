import type { MetadataRoute } from 'next';
import { getCategories, getProducts } from '@/lib/api';
import { SITE_URL } from '@/lib/env';

/** Lista de páginas para los buscadores: inicio, catálogo, categorías y fichas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([getCategories(), getProducts({ pageSize: 60 })]);
  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/muebles`, priority: 0.9 },
    { url: `${SITE_URL}/galeria`, priority: 0.6 },
    ...categories.map((category) => ({ url: `${SITE_URL}/muebles/${category.slug}`, priority: 0.7 })),
    ...products.items.map((product) => ({
      url: `${SITE_URL}/muebles/${product.category.slug}/${product.slug}`,
      priority: 0.8,
    })),
  ];
}
