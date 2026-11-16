import { buildWhatsAppLink, formatDimensions, formatPrice } from '@cva/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { GalleryTile, ProductGrid } from '@/components/product-card';
import { ArButton, ProductStage, ViewerProvider } from '@/components/product-viewer';
import { Icon, SectionTitle } from '@/components/ui';
import { getGallery, getProduct, getProducts, getSettings } from '@/lib/api';
import { SITE_URL } from '@/lib/env';

interface Props {
  params: Promise<{ categoria: string; slug: string }>;
}

// Sin lista previa: cada ficha se genera en la primera visita y queda guardada.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug).catch(() => null);
  if (!product) return { title: 'Mueble no encontrado' };
  const description =
    product.description || `${product.name}, en ${product.category.name.toLowerCase()}. Miralo en 3D.`;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/muebles/${product.category.slug}/${product.slug}` },
    // La foto que se ve al compartir el link por WhatsApp.
    openGraph: {
      title: product.name,
      description,
      images: product.coverUrl ? [{ url: product.coverUrl, alt: product.name }] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { categoria, slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  // Si el mueble cambió de categoría, los links viejos siguen funcionando.
  if (product.category.slug !== categoria) {
    permanentRedirect(`/muebles/${product.category.slug}/${product.slug}`);
  }

  const [settings, gallery, related] = await Promise.all([
    getSettings(),
    getGallery({ productId: product.id, pageSize: 6 }),
    getProducts({ category: product.category.slug, pageSize: 5 }),
  ]);
  const others = related.items.filter((item) => item.id !== product.id).slice(0, 4);
  const url = `${SITE_URL}/muebles/${product.category.slug}/${product.slug}`;
  const whatsappLink = buildWhatsAppLink(settings.whatsappNumber, settings.whatsappMessage, {
    producto: product.name,
    link: url,
  });

  const specs: [string, string][] = [];
  const dimensions = formatDimensions(product.widthCm, product.depthCm, product.heightCm);
  if (dimensions) specs.push(['Medidas (ancho × prof. × alto)', dimensions]);
  if (product.woods.length) specs.push(['Madera', product.woods.join(', ')]);
  if (product.materials) specs.push(['Materiales', product.materials]);
  specs.push(['Precio', formatPrice(product.price)]);

  return (
    <>
      <section className="wrap flex flex-col gap-5 pt-6 md:gap-8 md:pt-10">
        <nav aria-label="Ruta" className="text-[13px] text-muted md:text-[14px]">
          <Link href="/" className="hover:underline">
            Inicio
          </Link>
          {' / '}
          <Link href="/muebles" className="hover:underline">
            Catálogo
          </Link>
          {' / '}
          <Link href={`/muebles/${product.category.slug}`} className="hover:underline">
            {product.category.name}
          </Link>
          {' / '}
          <span aria-current="page">{product.name}</span>
        </nav>

        <ViewerProvider model={product.model}>
          <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-12">
            <div className="min-w-0 lg:flex-[4]">
              <ProductStage name={product.name} images={product.images} />
            </div>
            <div className="flex flex-col gap-4 md:gap-5 lg:flex-[3]">
              <span className="eyebrow">{product.category.name}</span>
              <h1 className="text-[32px] md:text-[44px]">{product.name}</h1>
              {product.description && (
                <p className="whitespace-pre-line text-[16px] leading-[1.6] text-muted md:text-[17px]">
                  {product.description}
                </p>
              )}
              <dl className="flex flex-col">
                {specs.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-line py-3.5 text-[15px]">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-1 flex flex-col gap-3">
                <ArButton />
                {whatsappLink ? (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
                    <Icon name="phone" size={18} /> Consultar por WhatsApp
                  </a>
                ) : (
                  <Link href="/#contacto" className="btn btn-outline">
                    <Icon name="pin" size={18} /> Consultar en el local
                  </Link>
                )}
                {whatsappLink && (
                  <span className="text-[13px] text-muted">
                    El mensaje ya sale escrito con el nombre del mueble y el link.
                  </span>
                )}
              </div>
            </div>
          </div>
        </ViewerProvider>
      </section>

      <section className="wrap flex flex-col gap-6 pt-12 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle title="Así quedó en casas de clientes" size="sm" />
          <Link href="/galeria/subir" className="btn btn-outline">
            <Icon name="up" size={18} /> Subir mi foto
          </Link>
        </div>
        {gallery.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {gallery.items.map((post) => (
              <GalleryTile key={post.id} post={{ ...post, product: null }} label={post.authorName} />
            ))}
          </div>
        ) : (
          <p className="card p-6 text-muted">
            Todavía no hay fotos de este mueble. Si lo tenés en tu casa, mostranos cómo quedó.
          </p>
        )}
      </section>

      {others.length > 0 && (
        <section className="wrap flex flex-col gap-6 pt-12 md:pt-16">
          <SectionTitle title="También te puede gustar" size="sm" />
          <ProductGrid products={others} />
        </section>
      )}
    </>
  );
}
