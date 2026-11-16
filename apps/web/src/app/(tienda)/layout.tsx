import { buildWhatsAppLink } from '@cva/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';
import { getCategories, getSettings } from '@/lib/api';

/** Marco de la tienda pública: encabezado y pie con los datos del local. */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const whatsappLink = buildWhatsAppLink(settings.whatsappNumber, 'Hola, quería hacer una consulta.');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-bg focus:px-4 focus:py-2">
        Saltar al contenido
      </a>
      <SiteHeader
        storeName={settings.storeName}
        tagline={settings.tagline}
        categories={categories}
        whatsappLink={whatsappLink}
      />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <footer className="mt-16 bg-ink text-footer md:mt-20">
        <div className="wrap grid gap-8 py-12 text-[14px] sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-2.5">
            <span className="font-serif text-[24px] font-bold text-white">{settings.storeName}</span>
            <span className="max-w-[320px] leading-relaxed">
              Muebles de madera hechos a mano. Miralos en 3D y probalos en tu casa antes de consultar.
            </span>
          </div>
          <nav aria-label="Pie de página" className="flex flex-col gap-1">
            <b className="mb-1 font-semibold text-white">Tienda</b>
            <Link href="/muebles" className="py-1 hover:underline">
              Catálogo
            </Link>
            <Link href="/galeria" className="py-1 hover:underline">
              Galería de clientes
            </Link>
            <Link href="/galeria/subir" className="py-1 hover:underline">
              Subir mi foto
            </Link>
          </nav>
          <div className="flex flex-col gap-2">
            <b className="font-semibold text-white">Contacto</b>
            {settings.address && (
              <span>
                {settings.address}
                {settings.city && `, ${settings.city}`}
              </span>
            )}
            {settings.hours && <span>{settings.hours}</span>}
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                WhatsApp +{settings.whatsappNumber}
              </a>
            )}
            {!settings.address && !settings.hours && !whatsappLink && (
              <span>{settings.city || 'Corrientes, Argentina'}</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
