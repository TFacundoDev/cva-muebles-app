'use client';

import type { GalleryCountsDto, Paginated, ProductAdminSummaryDto, StoreSettings } from '@cva/shared';
import Link from 'next/link';
import { Notice, Spinner } from '@/components/ui';
import { useApiData } from '@/lib/auth';

/** Resumen: números del catálogo y avisos de lo que falta configurar. */
export default function AdminHomePage() {
  const products = useApiData<Paginated<ProductAdminSummaryDto>>('/admin/products?pageSize=100');
  const counts = useApiData<GalleryCountsDto>('/admin/gallery/counts');
  const settings = useApiData<StoreSettings>('/settings/public');

  if (products.loading || counts.loading || settings.loading) return <Spinner />;
  const items = products.data?.items ?? [];
  const published = items.filter((p) => p.status === 'published').length;
  const drafts = items.filter((p) => p.status === 'draft').length;
  const with3d = items.filter((p) => p.has3d).length;
  const modelErrors = items.filter((p) => p.modelStatus === 'error').length;
  const pending = counts.data?.pending ?? 0;

  const cards = [
    { label: 'Publicados', value: published, href: '/admin/productos' },
    { label: 'Borradores', value: drafts, href: '/admin/productos' },
    { label: 'Con modelo 3D', value: with3d, href: '/admin/productos' },
    { label: 'Fotos por revisar', value: pending, href: '/admin/galeria' },
  ];

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Resumen</h1>
      {(products.error ?? counts.error) && <Notice kind="error">{products.error ?? counts.error}</Notice>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card flex flex-col gap-1 p-5 transition-colors hover:border-ink">
            <span className="font-serif text-[40px] font-semibold leading-none">{card.value}</span>
            <span className="text-[14px] text-muted">{card.label}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {pending > 0 && (
          <Notice>
            Hay {pending} {pending === 1 ? 'foto esperando' : 'fotos esperando'} tu revisión.{' '}
            <Link href="/admin/galeria" className="underline">
              Revisar ahora
            </Link>
          </Notice>
        )}
        {modelErrors > 0 && (
          <Notice kind="error">
            {modelErrors} {modelErrors === 1 ? 'modelo 3D falló' : 'modelos 3D fallaron'} al procesarse.{' '}
            <Link href="/admin/productos" className="underline">
              Ver productos
            </Link>
          </Notice>
        )}
        {settings.data && !settings.data.whatsappNumber && (
          <Notice>
            Falta cargar el número de WhatsApp: sin él, los botones de consulta no aparecen en la tienda.{' '}
            <Link href="/admin/ajustes" className="underline">
              Cargarlo
            </Link>
          </Notice>
        )}
        {settings.data && !settings.data.address && (
          <Notice>
            Falta la dirección del local.{' '}
            <Link href="/admin/ajustes" className="underline">
              Completar los datos del local
            </Link>
          </Notice>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/admin/productos/nuevo" className="btn btn-primary">
          Nuevo producto
        </Link>
        <Link href="/admin/galeria" className="btn btn-outline">
          Moderar galería
        </Link>
      </div>
    </>
  );
}
