import type { CategoryDto } from '@cva/shared';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-card';
import type React from 'react';
import { Icon } from '@/components/ui';
import { getCategories, getFacets, getProducts } from '@/lib/api';

export interface CatalogSearch {
  madera?: string;
  q?: string;
  con3d?: string;
  pagina?: string;
}

const PAGE_SIZE = 24;

/**
 * Catálogo con filtros. Lo comparten /muebles y /muebles/[categoria].
 * Los filtros viven en la URL: se pueden compartir y andan sin JavaScript.
 */
export async function CatalogView({ category, search }: { category: CategoryDto | null; search: CatalogSearch }) {
  const page = Math.max(1, Number(search.pagina) || 1);
  const with3d = search.con3d === '1';
  const [categories, facets, result] = await Promise.all([
    getCategories(),
    getFacets(),
    getProducts({
      category: category?.slug,
      wood: search.madera,
      q: search.q,
      with3d,
      page,
      pageSize: PAGE_SIZE,
    }),
  ]);

  const base = category ? `/muebles/${category.slug}` : '/muebles';
  // Arma un link que conserva los filtros actuales y cambia solo lo indicado.
  const link = (path: string, changes: Partial<Record<keyof CatalogSearch, string | undefined>> = {}) => {
    const params = new URLSearchParams();
    const next = { madera: search.madera, q: search.q, con3d: search.con3d, pagina: undefined, ...changes };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const hasFilters = !!(search.madera || search.q || with3d);

  const activeCount = Number(!!search.madera) + Number(with3d) + Number(!!category);

  // Fila de filtro con forma de casilla. Es un link: funciona sin JavaScript.
  const check = (href: string, label: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className="flex min-h-11 items-center gap-2.5 text-[15px] hover:text-acc"
    >
      <span
        className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[4px] border ${
          active ? 'border-acc bg-acc text-white' : 'border-muted bg-white'
        }`}
      >
        {active && <Icon name="check" size={14} />}
      </span>
      {label}
    </Link>
  );

  // Los mismos filtros se muestran al costado (escritorio) y plegados (celular).
  const filters = (
    <>
      <div className="flex flex-col">
        <b className="mb-1 text-[13px] uppercase tracking-[.1em] text-muted">Categorías</b>
        {check(link('/muebles'), 'Todos', !category)}
        {categories.map((item) => (
          <div key={item.id}>{check(link(`/muebles/${item.slug}`), item.name, category?.id === item.id)}</div>
        ))}
      </div>
      {facets.woods.length > 0 && (
        <div className="flex flex-col gap-3">
          <b className="text-[13px] uppercase tracking-[.1em] text-muted">Madera</b>
          <div className="flex flex-wrap gap-2">
            {facets.woods.map((wood) => {
              const active = search.madera === wood;
              return (
                <Link
                  key={wood}
                  href={link(base, { madera: active ? undefined : wood })}
                  aria-current={active ? 'true' : undefined}
                  className={`pill !min-h-10 !px-3.5 !font-medium ${active ? 'pill-active' : ''}`}
                >
                  {wood}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {check(link(base, { con3d: with3d ? undefined : '1' }), 'Solo con modelo 3D', with3d)}
    </>
  );

  return (
    <section className="wrap flex flex-col gap-6 pt-8 md:gap-8 md:pt-12">
      <div className="flex flex-col gap-2">
        <nav aria-label="Ruta" className="text-[14px] text-muted">
          <Link href="/" className="hover:underline">
            Inicio
          </Link>
          {' / '}
          {category ? (
            <>
              <Link href="/muebles" className="hover:underline">
                Catálogo
              </Link>
              {' / '}
              <span aria-current="page">{category.name}</span>
            </>
          ) : (
            <span aria-current="page">Catálogo</span>
          )}
        </nav>
        <h1 className="text-[34px] md:text-[46px]">{category ? category.name : 'Catálogo'}</h1>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <details className="card group lg:hidden">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5">
              <Icon name="filter" size={20} /> Filtros
              {activeCount > 0 && (
                <span className="rounded-full bg-acc px-2 py-0.5 text-[12px] text-white">{activeCount}</span>
              )}
            </span>
            <Icon name="down" size={18} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-6 border-t border-line p-4">{filters}</div>
        </details>
        <aside aria-label="Filtros" className="hidden w-[240px] flex-none flex-col gap-7 lg:flex">
          {filters}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
          <div id="buscar" className="flex scroll-mt-4 flex-wrap items-center justify-between gap-3">
            <form action={base} method="get" role="search" className="relative w-full sm:max-w-[380px] sm:flex-1">
              {search.madera && <input type="hidden" name="madera" value={search.madera} />}
              {with3d && <input type="hidden" name="con3d" value="1" />}
              <label htmlFor="buscar-q" className="sr-only">
                Buscar un mueble
              </label>
              <input
                id="buscar-q"
                type="search"
                name="q"
                defaultValue={search.q ?? ''}
                placeholder="Buscar un mueble…"
                className="field !rounded-full !pl-[18px] !pr-12"
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="absolute right-0 top-0 flex h-11 w-12 items-center justify-center text-muted hover:text-acc"
              >
                <Icon name="search" size={18} />
              </button>
            </form>
            <p className="text-[14px] text-muted" aria-live="polite">
              {result.total === 1 ? '1 mueble' : `${result.total} muebles`}
              {hasFilters && (
                <>
                  {' · '}
                  <Link href={base} className="font-semibold text-acc underline">
                    Quitar filtros
                  </Link>
                </>
              )}
            </p>
          </div>

          {result.items.length > 0 ? (
            <ProductGrid products={result.items} wide />
          ) : (
            <div className="card flex flex-col items-start gap-4 p-8">
              <p>No encontramos muebles con esos filtros.</p>
              <Link href="/muebles" className="btn btn-outline">
                Ver todo el catálogo
              </Link>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-center gap-3 pt-4">
              {page > 1 && (
                <Link href={link(base, { pagina: String(page - 1) })} className="btn btn-outline">
                  <Icon name="left" size={16} /> Anterior
                </Link>
              )}
              <span className="text-[14px] text-muted">
                Página {page} de {pages}
              </span>
              {page < pages && (
                <Link href={link(base, { pagina: String(page + 1) })} className="btn btn-outline">
                  Siguiente <Icon name="right" size={16} />
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
