import { formatPrice, type GalleryPostDto, type ProductSummaryDto } from '@cva/shared';
import Link from 'next/link';
import { Icon } from './ui';

export function productHref(product: { slug: string; category: { slug: string } }): string {
  return `/muebles/${product.category.slug}/${product.slug}`;
}

/** Tarjeta del catálogo: foto sobre fondo cálido, categoría, nombre y precio. */
export function ProductCard({ product }: { product: ProductSummaryDto }) {
  return (
    <Link
      href={productHref(product)}
      className="card group flex flex-col overflow-hidden transition-colors hover:border-ink"
    >
      <div className="relative flex aspect-square items-center justify-center bg-tint">
        {product.coverUrl ? (
          // Las fotos ya salen de la API en WebP y con tamaño acotado.
          <img
            src={product.coverUrl}
            alt={product.name}
            loading="lazy"
            className="h-[78%] w-[78%] object-contain transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <Icon name="photo" size={40} className="text-line" />
        )}
        {product.has3d && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white md:left-3 md:top-3 md:text-[12px]">
            <Icon name="cube" size={14} /> 3D · AR
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-3 pb-4 pt-3 md:px-[18px] md:pb-[18px] md:pt-4">
        <span className="text-[11px] uppercase tracking-[.08em] text-muted md:text-[12px]">
          {product.category.name}
        </span>
        <span className="font-serif text-[16px] font-semibold leading-tight md:text-[20px]">{product.name}</span>
        <span className="mt-0.5 text-[13px] font-semibold text-acc md:text-[14px]">{formatPrice(product.price)}</span>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, wide = false }: { products: ProductSummaryDto[]; wide?: boolean }) {
  return (
    <div
      className={`grid grid-cols-2 gap-3 md:gap-5 ${
        wide ? 'md:grid-cols-3 xl:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-4 lg:gap-6'
      }`}
    >
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

/**
 * Foto de la galería de clientes. Por defecto el nombre va en una etiqueta
 * sobre la foto; con `below`, el mueble y el autor van debajo.
 */
export function GalleryTile({ post, label, below = false }: { post: GalleryPostDto; label?: string; below?: boolean }) {
  const caption = label ?? (post.product ? `${post.product.name} · ${post.authorName}` : post.authorName);
  const alt = post.caption || `Foto de ${post.authorName}${post.product ? `: ${post.product.name}` : ''}`;
  const tile = below ? (
    <figure className="flex flex-col gap-2.5">
      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-tint">
        <img src={post.imageUrl} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <figcaption className="flex min-w-0 flex-col gap-0.5">
        <b className="truncate text-[14px] font-semibold md:text-[15px]">
          {post.product?.name ?? 'Mueble de CVA'}
        </b>
        <span className="truncate text-[13px] text-muted">{post.authorName}</span>
      </figcaption>
    </figure>
  ) : (
    <figure className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-tint">
      <img src={post.imageUrl} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      <figcaption className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-20px)] truncate rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-medium">
        {caption}
      </figcaption>
    </figure>
  );
  if (!post.product) return tile;
  return (
    <Link href={`/muebles/${post.product.categorySlug}/${post.product.slug}`} className="block">
      {tile}
    </Link>
  );
}
