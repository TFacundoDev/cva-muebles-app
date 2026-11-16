'use client';

import type { ProductSummaryDto } from '@cva/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { productHref } from './product-card';
import { Icon } from './ui';

const AUTOPLAY_MS = 6000;

/**
 * Portada del inicio: el texto a un lado y, del otro, un carrusel con los
 * muebles destacados dentro de un círculo. Avanza solo hasta que alguien lo
 * toca; quien pidió menos animaciones lo ve quieto.
 */
export function HeroCarousel({ products, tagline }: { products: ProductSummaryDto[]; tagline: string }) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const product = products[index];
  const many = products.length > 1;

  useEffect(() => {
    if (!auto || !many) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % products.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [auto, many, products.length]);

  const go = (next: number) => {
    setAuto(false);
    setIndex((next + products.length) % products.length);
  };

  const arrow =
    'flex h-11 w-11 flex-none items-center justify-center rounded-full border border-line bg-white transition-colors hover:border-ink';

  return (
    <div className="wrap flex flex-col gap-10 py-10 md:py-16 lg:flex-row lg:items-center lg:gap-12 lg:py-[72px]">
      <div className="flex flex-1 flex-col gap-5 md:gap-6">
        <span className="eyebrow">{tagline || 'Carpintería artesanal'}</span>
        <h1 className="text-[36px] leading-[1.05] sm:text-[44px] lg:text-[56px]">
          Muebles de madera que podés ver en tu casa antes de elegir
        </h1>
        <p className="max-w-[520px] text-[17px] leading-[1.55] text-muted md:text-[18px]">
          Giralos en 3D, mirá cómo quedan en tu living con realidad aumentada y consultanos por WhatsApp.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/muebles" className="btn btn-primary">
            Ver el catálogo
          </Link>
          <Link href={productHref(product)} className="btn btn-outline">
            <Icon name="cube" size={18} /> {product.has3d ? 'Probar el 3D' : 'Ver este mueble'}
          </Link>
        </div>
      </div>

      <div
        className="flex flex-1 flex-col items-center gap-4"
        role="group"
        aria-roledescription="carrusel"
        aria-label="Muebles destacados"
        onMouseEnter={() => setAuto(false)}
        onFocus={() => setAuto(false)}
      >
        <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
          {many && (
            <button type="button" onClick={() => go(index - 1)} aria-label="Mueble anterior" className={arrow}>
              <Icon name="left" />
            </button>
          )}
          <Link
            href={productHref(product)}
            aria-label={`Ver ${product.name}`}
            className="flex aspect-square w-full max-w-[280px] items-center justify-center rounded-full border border-line bg-white sm:max-w-[380px] lg:max-w-[440px]"
          >
            {product.coverUrl ? (
              <img
                key={product.id}
                src={product.coverUrl}
                alt={product.name}
                className="hero-fade h-[78%] w-[78%] object-contain"
              />
            ) : (
              <Icon name="photo" size={56} className="text-line" />
            )}
          </Link>
          {many && (
            <button type="button" onClick={() => go(index + 1)} aria-label="Mueble siguiente" className={arrow}>
              <Icon name="right" />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
          <span className="font-serif text-[20px] font-semibold md:text-[22px]">{product.name}</span>
          <span className="text-[14px] text-muted">
            {product.category.name}
            {product.woods.length > 0 && ` · ${product.woods.join(' y ')}`}
          </span>
        </div>

        {many && (
          <div className="flex items-center">
            {products.map((item, position) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(position)}
                aria-label={`Mostrar ${item.name}`}
                aria-current={position === index ? 'true' : undefined}
                className="flex h-11 w-7 items-center justify-center"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all ${
                    position === index ? 'w-6 bg-acc' : 'w-2.5 bg-line'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
