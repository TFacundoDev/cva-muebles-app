import { buildWhatsAppLink } from '@cva/shared';
import Link from 'next/link';
import { HeroCarousel } from '@/components/hero-carousel';
import { GalleryTile, ProductGrid } from '@/components/product-card';
import { Icon, type IconName, SectionTitle } from '@/components/ui';
import { getCategories, getGallery, getProducts, getSettings } from '@/lib/api';

const BENEFITS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'cube', title: 'Modelo 3D de cada mueble', text: 'Rotalo y mirá cada detalle desde todos los ángulos.' },
  { icon: 'home', title: 'Probalo en tu casa', text: 'Con la cámara del celular, a tamaño real.' },
  { icon: 'leaf', title: 'Madera maciza', text: 'Trabajada a mano en nuestro taller.' },
];

export default async function HomePage() {
  const [settings, categories, catalog, gallery] = await Promise.all([
    getSettings(),
    getCategories(),
    getProducts({ pageSize: 60 }),
    getGallery({ pageSize: 4 }),
  ]);
  const products = catalog.items;
  const featured = products.filter((product) => product.featured);
  // En el carrusel van primero los que tienen modelo 3D.
  const hero = [...(featured.length > 0 ? featured : products)]
    .sort((a, b) => Number(b.has3d) - Number(a.has3d))
    .slice(0, 5);
  const highlights = (featured.length > 0 ? featured : products).slice(0, 4);
  // Cada categoría se ilustra con la foto de uno de sus muebles.
  const categoryCover = (slug: string) =>
    products.find((product) => product.category.slug === slug && product.coverUrl)?.coverUrl;
  // La cantidad por categoría solo se muestra si la lista de arriba trajo todo el catálogo.
  const complete = catalog.total <= products.length;
  const categoryCount = (slug: string) => products.filter((product) => product.category.slug === slug).length;
  const whatsappLink = buildWhatsAppLink(settings.whatsappNumber, 'Hola, quería hacer una consulta.');
  const fullAddress = [settings.address, settings.city].filter(Boolean).join(', ');

  return (
    <>
      <section className="bg-gradient-to-b from-bg to-tint">
        {hero.length > 0 ? (
          <HeroCarousel products={hero} tagline={settings.tagline} />
        ) : (
          <div className="wrap flex flex-col gap-5 py-16">
            <span className="eyebrow">{settings.tagline || 'Carpintería artesanal'}</span>
            <h1 className="max-w-[720px] text-[36px] leading-[1.05] md:text-[56px]">
              Muebles de madera que podés ver en tu casa antes de elegir
            </h1>
            <div>
              <Link href="/muebles" className="btn btn-primary">
                Ver el catálogo
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-line bg-white">
        <ul className="wrap grid gap-5 py-7 md:grid-cols-3 md:gap-6">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex items-start gap-3.5">
              <Icon name={benefit.icon} size={28} className="text-acc" />
              <div className="flex flex-col gap-1">
                <b className="font-semibold">{benefit.title}</b>
                <span className="text-[14px] text-muted">{benefit.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {categories.length > 0 && (
        <section className="wrap flex flex-col gap-7 pt-12 md:gap-8 md:pt-16">
          <SectionTitle title="Elegí por ambiente" subtitle="Empezá por el lugar de la casa que querés armar." />
          <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
            {categories.map((category) => {
              const cover = categoryCover(category.slug);
              const count = categoryCount(category.slug);
              return (
                <Link
                  key={category.id}
                  href={`/muebles/${category.slug}`}
                  className="group flex flex-col items-start gap-2 rounded-2xl bg-tint p-4 transition-colors hover:bg-line md:gap-3 md:p-6"
                >
                  <span className="flex h-[110px] w-full items-center justify-center md:h-[150px]">
                    {cover ? (
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <Icon name="cube" size={40} className="text-muted" />
                    )}
                  </span>
                  <span className="font-serif text-[20px] font-semibold md:text-[24px]">{category.name}</span>
                  {complete && (
                    <span className="text-[13px] text-muted md:text-[14px]">
                      {count === 1 ? '1 mueble' : `${count} muebles`}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {highlights.length > 0 && (
        <section className="wrap flex flex-col gap-7 pt-12 md:gap-8 md:pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle
              title={featured.length > 0 ? 'Destacados' : 'Lo nuevo en el taller'}
              subtitle={featured.length > 0 ? 'Los que más nos piden.' : 'Recién salidos del taller.'}
            />
            <Link href="/muebles" className="btn btn-outline">
              Ver todo
            </Link>
          </div>
          <ProductGrid products={highlights} />
        </section>
      )}

      {gallery.items.length > 0 && (
        <section className="wrap flex flex-col gap-7 pt-12 md:gap-8 md:pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle title="Así quedaron en sus casas" subtitle="Fotos reales que mandan nuestros clientes." />
            <Link href="/galeria" className="btn btn-outline">
              Ver toda la galería
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {gallery.items.map((post) => (
              <GalleryTile key={post.id} post={post} label={post.authorName} />
            ))}
          </div>
        </section>
      )}

      {settings.aboutText && (
        <section className="wrap pt-12 md:pt-16">
          <div className="card flex flex-col gap-4 p-6 md:p-10">
            <SectionTitle title={settings.aboutTitle || 'El taller'} />
            {settings.aboutText.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="max-w-[760px] text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Última sección: llega hasta el pie, por eso compensa el margen de arriba del footer. */}
      <section id="contacto" className="-mb-16 mt-12 scroll-mt-4 bg-tint md:-mb-20 md:mt-16">
        <div className="wrap flex flex-col gap-8 py-12 md:py-16 lg:flex-row lg:gap-10">
          <div className="flex flex-1 flex-col gap-6">
            <SectionTitle title="Visitá el local" subtitle="Venite a ver y tocar la madera." />
            <ul className="flex flex-col gap-4">
              <li className="flex items-center gap-3">
                <Icon name="pin" size={22} />
                <span>{fullAddress || 'Corrientes, Argentina'}</span>
              </li>
              {settings.hours && (
                <li className="flex items-center gap-3">
                  <Icon name="clock" size={22} />
                  <span>{settings.hours}</span>
                </li>
              )}
              {whatsappLink && (
                <li className="flex items-center gap-3">
                  <Icon name="phone" size={22} />
                  <span>WhatsApp +{settings.whatsappNumber}</span>
                </li>
              )}
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {settings.mapLink && (
                <a href={settings.mapLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                  <Icon name="pin" size={18} /> Cómo llegar
                </a>
              )}
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
                  <Icon name="phone" size={18} /> Escribinos por WhatsApp
                </a>
              )}
            </div>
          </div>
          <div className="card flex min-h-[280px] flex-1 flex-col items-center justify-center overflow-hidden md:min-h-[320px]">
            {settings.mapEmbedUrl ? (
              <iframe
                src={settings.mapEmbedUrl}
                title="Mapa con la ubicación del local"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[280px] w-full border-0 md:min-h-[320px]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-muted">
                <Icon name="pin" size={44} className="text-acc" />
                <b className="font-semibold text-ink">{settings.city || 'Corrientes'}</b>
                {settings.address && <span className="text-[14px]">{settings.address}</span>}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
