import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionTitle } from '@/components/ui';
import { UploadPhotoForm } from '@/components/upload-photo-form';

export const metadata: Metadata = {
  title: 'Subí tu foto',
  description: 'Mostranos cómo quedó tu mueble en tu casa.',
};

export default function UploadPhotoPage() {
  return (
    <section className="wrap flex flex-col gap-6 pt-10 md:pt-12">
      <nav aria-label="Ruta" className="text-[13px] text-muted">
        <Link href="/galeria" className="hover:underline">
          Galería
        </Link>
        {' / '}
        <span aria-current="page">Subir foto</span>
      </nav>
      <div className="flex max-w-[560px] flex-col gap-6">
        <SectionTitle eyebrow="Galería" title="Subí tu foto" as="h1" size="lg" />
        <p className="text-muted">Mostranos cómo quedó tu mueble. La revisamos antes de publicarla.</p>
        <UploadPhotoForm />
      </div>
    </section>
  );
}
