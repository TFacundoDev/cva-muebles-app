'use client';

import type { GalleryCountsDto } from '@cva/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useApiData, useAuth } from '@/lib/auth';
import { Notice, Spinner } from '../ui';

/** Otras pantallas avisan con este evento cuando cambian las fotos pendientes. */
export const GALLERY_CHANGED = 'cva:gallery-changed';

const TABS = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/productos', label: 'Productos' },
  { href: '/admin/categorias', label: 'Categorías' },
  { href: '/admin/galeria', label: 'Galería' },
  { href: '/admin/ajustes', label: 'Ajustes del local' },
  { href: '/admin/usuarios', label: 'Usuarios' },
];

/**
 * Marco del panel. Decide qué mostrar según la sesión: login, "sin acceso" o
 * el panel. Esto es solo comodidad: la protección real está en la API, que
 * rechaza cualquier pedido a /admin sin un token de dueño.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { status, me, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';
  const isOwner = status === 'user' && me?.role === 'owner';
  const counts = useApiData<GalleryCountsDto>(isOwner ? '/admin/gallery/counts' : null);

  useEffect(() => {
    if (status === 'guest' && !isLogin) router.replace('/admin/login');
    if (isOwner && isLogin) router.replace('/admin');
  }, [status, isLogin, isOwner, router]);

  const reloadCounts = counts.reload;
  useEffect(() => {
    const onChange = () => void reloadCounts();
    window.addEventListener(GALLERY_CHANGED, onChange);
    return () => window.removeEventListener(GALLERY_CHANGED, onChange);
  }, [reloadCounts]);

  const pending = counts.data?.pending ?? 0;
  const account = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
      {me && <span className="truncate">{isOwner ? 'Dueño · ' : ''}{me.displayName}</span>}
      <Link href="/" className="font-semibold text-acc hover:underline">
        Ver la tienda
      </Link>
      {status === 'user' && (
        <button type="button" onClick={() => void signOut()} className="font-semibold text-acc hover:underline">
          Salir
        </button>
      )}
    </div>
  );

  let body: ReactNode;
  if (status === 'loading') {
    body = <Spinner label="Comprobando tu sesión…" />;
  } else if (isLogin) {
    body = status === 'guest' ? children : null;
  } else if (status === 'guest') {
    body = <Spinner label="Redirigiendo al ingreso…" />;
  } else if (!isOwner) {
    body = (
      <div className="flex max-w-[520px] flex-col gap-4 pt-6">
        <h1 className="text-[32px]">Tu cuenta no tiene acceso al panel</h1>
        <Notice>
          Entraste como {me?.email}. El panel es solo para el dueño del negocio. Si sos vos, pedí que agreguen tu
          email a la lista de dueños (OWNER_EMAILS) de la API.
        </Notice>
        <div>
          <button type="button" onClick={() => void signOut()} className="btn btn-outline">
            Salir y entrar con otra cuenta
          </button>
        </div>
      </div>
    );
  } else {
    body = children;
  }

  // En escritorio la navegación es una columna fija; en el celular, una fila que se desliza.
  return (
    <div className="flex min-h-screen flex-col bg-panel lg:flex-row">
      <aside className="flex flex-none flex-col gap-3 bg-tint px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:gap-1.5 lg:py-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 lg:pb-4">
          <Link href="/admin" className="px-1 font-serif text-[22px] font-bold lg:px-3.5">
            CVA · Panel
          </Link>
          <div className="lg:hidden">{account}</div>
        </div>
        {isOwner && !isLogin && (
          <nav aria-label="Secciones del panel" className="hscroll !gap-1.5 lg:!flex-col lg:!flex-nowrap">
            {TABS.map((tab) => {
              const active = tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 flex-none items-center justify-between gap-2.5 whitespace-nowrap rounded-[10px] px-3.5 text-[15px] transition-colors ${
                    active ? 'bg-white font-semibold' : 'font-medium hover:bg-white/60'
                  }`}
                >
                  {tab.label}
                  {tab.href === '/admin/galeria' && pending > 0 && (
                    <span
                      className="rounded-full bg-acc px-2 py-0.5 text-[12px] font-semibold text-white"
                      aria-label={`${pending} pendientes`}
                    >
                      {pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="mt-auto hidden px-3.5 lg:block">{account}</div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-4 pb-20 pt-6 md:px-9 md:pt-9">{body}</main>
    </div>
  );
}
