import type { ReactNode } from 'react';

const ICONS = {
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7v9H4z" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  phone: <path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-3z" />,
  up: <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  rotate: <path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" />,
  down: <path d="M6 9l6 6 6-6" />,
  left: <path d="M15 6l-6 6 6 6" />,
  right: <path d="M9 6l6 6-6 6" />,
  leaf: (
    <>
      <path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15" />
      <path d="M5 19c3-5 6-8 10-10" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  photo: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  alert: (
    <>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** Iconos de línea fina, todos con el mismo trazo. Son decorativos: el texto va al lado. */
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ''}`}
    >
      {ICONS[name]}
    </svg>
  );
}

/** Encabezado de sección: título en serif y, si hace falta, una línea de apoyo debajo. */
export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  as: Tag = 'h2',
  size = 'md',
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = {
    sm: 'text-[24px] md:text-[30px]',
    md: 'text-[28px] md:text-[36px]',
    lg: 'text-[34px] md:text-[46px]',
  };
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <Tag className={sizes[size]}>{title}</Tag>
      {subtitle && <p className="text-muted">{subtitle}</p>}
    </div>
  );
}

/** Mensaje de estado dentro de formularios y pantallas del panel. */
export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const styles = {
    info: 'border-line bg-tint text-ink',
    error: 'border-[#e5b3ab] bg-[#f8dad5] text-[#7a1f14]',
    ok: 'border-[#b5d9c1] bg-[#dcefe2] text-[#17502f]',
  };
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[14px] ${styles[kind]}`}>
      <Icon name={kind === 'error' ? 'alert' : kind === 'ok' ? 'check' : 'clock'} size={18} className="mt-0.5" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-[14px] text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-acc" />
      {label}
    </div>
  );
}
