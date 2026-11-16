import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { type CatalogSearch, CatalogView } from '@/components/catalog-view';
import { getCategories } from '@/lib/api';

interface Props {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<CatalogSearch>;
}

async function findCategory(slug: string) {
  return (await getCategories()).find((category) => category.slug === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await findCategory((await params).categoria);
  if (!category) return {};
  return { title: category.name, description: `Muebles de madera para ${category.name.toLowerCase()}.` };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const category = await findCategory((await params).categoria);
  if (!category) notFound();
  return <CatalogView category={category} search={await searchParams} />;
}
