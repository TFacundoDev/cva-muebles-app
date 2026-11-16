'use client';

import {
  type Paginated,
  type ProductAdminSummaryDto,
  PRODUCT_STATUS_LABELS,
} from '@cva/shared';
import Link from 'next/link';
import { useState } from 'react';
import { ModelBadge } from '@/components/admin/model-badge';
import { Icon, Notice, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';

export default function AdminProductsPage() {
  const { api } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const products = useApiData<Paginated<ProductAdminSummaryDto>>(
    `/admin/products?pageSize=100${query ? `&q=${encodeURIComponent(query)}` : ''}`,
  );
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await products.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const toggle = (product: ProductAdminSummaryDto) =>
    run(() =>
      api.patch(`/admin/products/${product.id}`, {
        status: product.status === 'published' ? 'hidden' : 'published',
      }),
    );

  const remove = (product: ProductAdminSummaryDto) => {
    if (!window.confirm(`¿Borrar "${product.name}"? También se borran sus fotos y su modelo 3D. No se puede deshacer.`)) return;
    void run(() => api.del(`/admin/products/${product.id}`));
  };

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Productos</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          role="search"
          className="flex w-full gap-2 sm:w-auto sm:max-w-[380px] sm:flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label htmlFor="buscar-producto" className="sr-only">
            Buscar producto
          </label>
          <input
            id="buscar-producto"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto…"
            className="field !rounded-full !px-[18px]"
          />
          <button type="submit" aria-label="Buscar" className="btn btn-outline !px-4">
            <Icon name="search" size={18} />
          </button>
        </form>
        <Link href="/admin/productos/nuevo" className="btn btn-primary">
          Nuevo producto
        </Link>
      </div>

      {(error ?? products.error) && <Notice kind="error">{error ?? products.error}</Notice>}

      {products.loading ? (
        <Spinner />
      ) : products.data?.items.length === 0 ? (
        <p className="card p-8 text-muted">
          {query ? 'No hay productos con ese nombre.' : 'Todavía no hay productos. Cargá el primero.'}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-muted">
                <th className="px-4 py-3.5 font-semibold">Producto</th>
                <th className="px-4 py-3.5 font-semibold">Categoría</th>
                <th className="px-4 py-3.5 font-semibold">Modelo 3D</th>
                <th className="px-4 py-3.5 font-semibold">Estado</th>
                <th className="px-4 py-3.5 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.data?.items.map((product) => (
                <tr key={product.id} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/productos/${product.id}`} className="flex items-center gap-3.5 hover:underline">
                      <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[10px] bg-tint">
                        {product.coverUrl ? (
                          <img src={product.coverUrl} alt="" className="h-[80%] w-[80%] object-contain" />
                        ) : (
                          <Icon name="photo" size={20} className="text-line" />
                        )}
                      </span>
                      <span className="font-semibold">
                        {product.name}
                        {product.featured && <span className="ml-2 text-[12px] font-medium text-acc">Destacado</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{product.category.name}</td>
                  <td className="px-4 py-2.5">
                    <ModelBadge status={product.modelStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-muted">{PRODUCT_STATUS_LABELS[product.status]}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3.5 text-[14px] font-semibold text-acc">
                      <Link href={`/admin/productos/${product.id}`} className="hover:underline">
                        Editar
                      </Link>
                      <button type="button" onClick={() => void toggle(product)} className="hover:underline">
                        {product.status === 'published' ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button type="button" onClick={() => remove(product)} className="hover:underline">
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
