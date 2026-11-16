'use client';

import type { CategoryDto } from '@cva/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './ui';

interface Props {
  storeName: string;
  tagline: string;
  categories: CategoryDto[];
  whatsappLink: string | null;
}

/**
 * Encabezado de la tienda. En escritorio: logo, navegación y botones en una fila.
 * En el celular quedan el logo, WhatsApp y un botón que despliega el menú.
 */
export function SiteHeader({ storeName, tagline, categories, whatsappLink }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Al cambiar de página se cierra el menú del celular.
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: '/', label: 'Inicio', active: pathname === '/' },
    { href: '/muebles', label: 'Catálogo', active: pathname.startsWith('/muebles') },
    { href: '/galeria', label: 'Galería', active: pathname.startsWith('/galeria') },
    { href: '/#contacto', label: 'Contacto', active: false },
  ];

  return (
    <header className="relative z-30 border-b border-line bg-bg">
      <div className="wrap flex items-center justify-between gap-4 py-3.5 lg:py-4">
        <Link href="/" className="flex min-w-0 flex-col leading-none">
          <span className="truncate font-serif text-[22px] font-bold md:text-[26px]">{storeName}</span>
          {tagline && (
            <span className="mt-1 truncate text-[10px] uppercase tracking-[.18em] text-muted md:text-[11px]">
              {tagline}
            </span>
          )}
        </Link>

        {/* Escritorio */}
        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? 'page' : undefined}
              className={`border-b-2 px-1 py-2.5 text-[15px] transition-colors ${
                link.active
                  ? 'border-acc font-semibold text-acc'
                  : 'border-transparent font-medium hover:border-line hover:text-acc'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden gap-2.5 lg:flex">
          <Link href="/ingresar" className="btn btn-outline">
            Ingresar
          </Link>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
              <Icon name="phone" size={18} /> WhatsApp
            </a>
          )}
        </div>

        {/* Celular */}
        <div className="flex flex-none gap-2 lg:hidden">
          {whatsappLink && (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Escribir por WhatsApp"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-wa text-white"
            >
              <Icon name="phone" size={20} />
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ink"
          >
            <Icon name={open ? 'x' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="menu-movil"
          aria-label="Menú"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto border-b border-line bg-bg shadow-[0_12px_24px_rgba(43,29,20,.12)] lg:hidden"
        >
          <div className="wrap flex flex-col pb-5 pt-1">
            <MenuLink href="/" label="Inicio" big />
            <MenuLink href="/muebles" label="Catálogo" big />
            {categories.map((category) => (
              <MenuLink key={category.id} href={`/muebles/${category.slug}`} label={category.name} />
            ))}
            <MenuLink href="/galeria" label="Galería de clientes" big />
            <MenuLink href="/galeria/subir" label="Subir mi foto" />
            <MenuLink href="/#contacto" label="Contacto" big onNavigate={() => setOpen(false)} />
            <div className="mt-5 flex flex-col gap-2.5">
              <Link href="/ingresar" className="btn btn-outline">
                Ingresar
              </Link>
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-wa">
                  <Icon name="phone" size={18} /> Escribir por WhatsApp
                </a>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

function MenuLink({
  href,
  label,
  big = false,
  onNavigate,
}: {
  href: string;
  label: string;
  big?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex min-h-[50px] items-center justify-between border-b border-line ${
        big ? 'font-serif text-[21px] font-semibold' : 'pl-4 text-[15px] text-muted'
      }`}
    >
      {label}
      <Icon name="right" size={18} />
    </Link>
  );
}
