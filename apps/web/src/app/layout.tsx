import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SITE_URL } from '@/lib/env';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'CVA Muebles · Muebles de madera en Corrientes', template: '%s · CVA Muebles' },
  description:
    'Muebles de madera hechos en Corrientes. Miralos en 3D, probalos en tu casa con realidad aumentada y consultá por WhatsApp.',
  openGraph: { type: 'website', locale: 'es_AR', siteName: 'CVA Muebles' },
};

export const viewport: Viewport = { themeColor: '#f5efe6' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
