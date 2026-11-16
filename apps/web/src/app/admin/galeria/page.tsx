'use client';

import {
  GALLERY_STATUSES,
  type GalleryAdminDto,
  type GalleryCountsDto,
  type GalleryStatus,
  type Paginated,
} from '@cva/shared';
import { useState } from 'react';
import { GALLERY_CHANGED } from '@/components/admin/admin-shell';
import { Icon, Notice, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';

const TAB_LABELS: Record<GalleryStatus, string> = {
  pending: 'Pendientes',
  approved: 'Aprobadas',
  rejected: 'Rechazadas',
  hidden: 'Ocultas',
};

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `Hace ${Math.max(1, minutes)} min`;
  if (minutes < 60 * 24) return `Hace ${Math.round(minutes / 60)} h`;
  if (minutes < 60 * 48) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-AR');
}

/** Moderación: nada se publica en la galería hasta que el dueño lo aprueba. */
export default function AdminGalleryPage() {
  const { api } = useAuth();
  const [status, setStatus] = useState<GalleryStatus>('pending');
  const posts = useApiData<Paginated<GalleryAdminDto>>(`/admin/gallery?status=${status}&pageSize=60`);
  const counts = useApiData<GalleryCountsDto>('/admin/gallery/counts');
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await Promise.all([posts.reload(), counts.reload()]);
      window.dispatchEvent(new Event(GALLERY_CHANGED));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const moderate = (post: GalleryAdminDto, next: 'approved' | 'rejected' | 'hidden') =>
    run(() => api.patch(`/admin/gallery/${post.id}`, { status: next }));

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Moderar galería</h1>
      <div className="hscroll" role="tablist" aria-label="Estado de las fotos">
        {GALLERY_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => setStatus(value)}
            className={`pill ${status === value ? 'pill-active' : ''}`}
          >
            {TAB_LABELS[value]} ({counts.data?.[value] ?? 0})
          </button>
        ))}
      </div>

      {(error ?? posts.error) && <Notice kind="error">{error ?? posts.error}</Notice>}

      {posts.loading ? (
        <Spinner />
      ) : posts.data?.items.length === 0 ? (
        <p className="card p-8 text-muted">
          {status === 'pending' ? 'No hay fotos esperando revisión.' : 'No hay fotos en este estado.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.data?.items.map((post) => (
            <li key={post.id} className="card flex flex-col gap-4 p-4 md:flex-row md:items-center md:gap-5">
              <a href={post.imageUrl} target="_blank" rel="noopener noreferrer" className="block flex-none" aria-label="Abrir la foto en tamaño completo">
                <img src={post.imageUrl} alt={`Foto enviada por ${post.authorName}`} className="h-[200px] w-full rounded-xl bg-tint object-cover md:h-[120px] md:w-[160px]" />
              </a>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[17px] font-semibold">{post.product?.name ?? 'Mueble que ya no está publicado'}</span>
                <span className="text-[14px] text-muted">
                  Enviada por {post.authorName} ({post.authorEmail}) · {timeAgo(post.createdAt)}
                </span>
                {post.caption && <span className="text-[14px]">“{post.caption}”</span>}
                <span className="text-[13px] text-muted">Aceptó la publicación</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {post.status !== 'approved' && (
                  <button type="button" onClick={() => void moderate(post, 'approved')} className="btn btn-wa">
                    <Icon name="check" size={18} /> Aprobar
                  </button>
                )}
                {post.status === 'pending' && (
                  <button type="button" onClick={() => void moderate(post, 'rejected')} className="btn btn-outline">
                    <Icon name="x" size={18} /> Rechazar
                  </button>
                )}
                {post.status === 'approved' && (
                  <button type="button" onClick={() => void moderate(post, 'hidden')} className="btn btn-outline">
                    Ocultar
                  </button>
                )}
                {post.status !== 'pending' && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      if (window.confirm('¿Borrar esta foto para siempre?')) void run(() => api.del(`/admin/gallery/${post.id}`));
                    }}
                  >
                    <Icon name="trash" size={18} /> Borrar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
