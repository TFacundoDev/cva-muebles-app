import type { Metadata } from 'next';
import { type CatalogSearch, CatalogView } from '@/components/catalog-view';

export const metadata: Metadata = {
  title: 'Catálogo',
  description: 'Todos los muebles de madera del taller, con fotos, medidas y modelo 3D.',
};

export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogSearch> }) {
  return <CatalogView category={null} search={await searchParams} />;
}
