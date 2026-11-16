import type { Metadata } from 'next';
import Link from 'next/link';
import { GalleryTile } from '@/components/product-card';
import { Icon, SectionTitle } from '@/components/ui';
import { getCategories, getGallery } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Galería de clientes',
  description: 'Fotos que mandan nuestros clientes: así quedaron los muebles en sus casas.',
};

const PAGE_SIZE = 24;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; pagina?: string }>;
}) {
  const { categoria, pagina } = await searchParams;
  const page = Math.max(1, Number(pagina) || 1);
  const [categories, gallery] = await Promise.all([
    getCategories(),
    getGallery({ category: categoria, page, pageSize: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(gallery.total / PAGE_SIZE));
  const href = (category?: string, targetPage?: number) => {
    const params = new URLSearchParams();
    if (category) params.set('categoria', category);
    if (targetPage && targetPage > 1) params.set('pagina', String(targetPage));
    const query = params.toString();
    return query ? `/galeria?${query}` : '/galeria';
  };

  return (
    <section className="wrap flex flex-col gap-6 pt-8 md:gap-8 md:pt-12">
      <SectionTitle
        title="Galería de clientes"
        subtitle="Nuestros muebles en casas reales. Tocá una foto para ir al mueble."
        as="h1"
        size="lg"
      />

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <nav aria-label="Filtrar por categoría" className="hscroll">
            <Link href={href()} className={`pill ${categoria ? '' : 'pill-active'}`}>
              Todas
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={href(category.slug)}
                className={`pill ${categoria === category.slug ? 'pill-active' : ''}`}
              >
                {category.name}
              </Link>
            ))}
          </nav>

          {gallery.items.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 md:gap-6">
              {gallery.items.map((post) => (
                <GalleryTile key={post.id} post={post} below />
              ))}
            </div>
          ) : (
            <p className="card p-8 text-muted">
              Todavía no hay fotos{categoria ? ' en esta categoría' : ''}. ¡La tuya puede ser la primera!
            </p>
          )}

          {pages > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-center gap-3 pt-2">
              {page > 1 && (
                <Link href={href(categoria, page - 1)} className="btn btn-outline">
                  <Icon name="left" size={16} /> Anterior
                </Link>
              )}
              <span className="text-[14px] text-muted">
                Página {page} de {pages}
              </span>
              {page < pages && (
                <Link href={href(categoria, page + 1)} className="btn btn-outline">
                  Siguiente <Icon name="right" size={16} />
                </Link>
              )}
            </nav>
          )}
        </div>

        <aside className="card order-first flex flex-col gap-4 !rounded-[20px] p-6 lg:order-none lg:w-[340px] lg:flex-none lg:p-7">
          <h2 className="text-[24px]">Subí tu foto</h2>
          <p className="text-[14px] text-muted">
            Mostranos cómo quedó tu mueble. Entrás con tu cuenta de Google, elegís el mueble y subís la foto. La
            revisamos antes de publicarla.
          </p>
          <Link href="/galeria/subir" className="btn btn-primary">
            <Icon name="up" size={18} /> Subir mi foto
          </Link>
        </aside>
      </div>
    </section>
  );
}
