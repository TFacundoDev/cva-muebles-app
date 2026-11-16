'use client';

import {
  GALLERY_STATUS_LABELS,
  type GalleryMineDto,
  IMAGE_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  type Paginated,
  type ProductSummaryDto,
} from '@cva/shared';
import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';
import { LoginPanel } from './login-panel';
import { Icon, Notice, Spinner } from './ui';

/** Formulario para que un cliente suba la foto de su mueble a la galería. */
export function UploadPhotoForm() {
  const { status, me, api, signOut } = useAuth();
  const products = useApiData<Paginated<ProductSummaryDto>>(status === 'user' ? '/products?pageSize=60' : null);
  const mine = useApiData<GalleryMineDto[]>(status === 'user' ? '/gallery/mine' : null);

  const [productId, setProductId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Vista previa de la foto elegida.
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(candidate: File | undefined) {
    setError(null);
    if (!candidate) return;
    if (!(IMAGE_CONTENT_TYPES as readonly string[]).includes(candidate.type)) {
      return setError('Elegí una foto en formato JPG, PNG o WebP.');
    }
    if (candidate.size > MAX_IMAGE_BYTES) return setError('La foto pesa más de 10 MB. Elegí una más liviana.');
    setFile(candidate);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !productId || !consent) return;
    setError(null);
    setProgress(0);
    try {
      const key = await api.upload('/gallery/upload-url', file, {}, setProgress);
      await api.post('/gallery', { key, productId, caption, consent: true });
      setSent(true);
      setFile(null);
      setCaption('');
      setConsent(false);
      void mine.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProgress(null);
    }
  }

  if (status === 'loading') return <Spinner />;

  if (status === 'guest') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-muted">
          Para subir una foto necesitás entrar con tu cuenta. Solo usamos tu nombre para mostrarlo junto a la foto.
        </p>
        <LoginPanel />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
        Entraste como {me?.displayName}.
        <button type="button" onClick={() => void signOut()} className="text-acc underline">
          Salir
        </button>
      </p>

      {sent && (
        <Notice kind="ok">
          ¡Gracias! Recibimos tu foto. La revisamos antes de publicarla en la galería.{' '}
          <button type="button" onClick={() => setSent(false)} className="underline">
            Subir otra
          </button>
        </Notice>
      )}

      {!sent && (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
          <div>
            <label htmlFor="foto-mueble" className="label">
              ¿Qué mueble es?
            </label>
            <select
              id="foto-mueble"
              required
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="field !rounded-full !px-5"
            >
              <option value="">Elegí el mueble</option>
              {products.data?.items.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Tu foto</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files[0]);
              }}
              className={`flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-white p-4 text-[14px] text-muted ${
                dragging ? 'bg-tint' : ''
              }`}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Vista previa de tu foto" className="max-h-[260px] max-w-full object-contain" />
                  <span>Tocá para cambiarla</span>
                </>
              ) : (
                <>
                  <Icon name="up" size={26} />
                  <span>Tocá para elegir una foto, o arrastrala acá</span>
                  <span className="text-[12px]">JPG, PNG o WebP · hasta 10 MB</span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_CONTENT_TYPES.join(',')}
              className="sr-only"
              aria-label="Elegir foto"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </div>

          <div>
            <label htmlFor="foto-comentario" className="label">
              Comentario <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="foto-comentario"
              value={caption}
              maxLength={200}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Ej.: Quedó perfecto en el living"
              className="field"
            />
          </div>

          <label className="flex gap-3 text-[13px] leading-snug text-muted">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] flex-none accent-acc"
            />
            <span>
              Acepto que se publique mi foto en la galería junto a mi nombre de pila. Sin caras ni datos personales
              a la vista. Puedo pedir que la quiten cuando quiera.
            </span>
          </label>

          {error && <Notice kind="error">{error}</Notice>}

          <button type="submit" disabled={!file || !productId || !consent || progress !== null} className="btn btn-primary">
            {progress !== null ? `Subiendo… ${Math.round(progress * 100)}%` : 'Enviar para aprobación'}
          </button>
        </form>
      )}

      {mine.data && mine.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[22px]">Tus fotos</h2>
          <ul className="flex flex-col">
            {mine.data.map((post) => (
              <li key={post.id} className="flex items-center gap-4 border-t border-line py-3">
                <img src={post.imageUrl} alt="" className="h-14 w-[74px] flex-none rounded-lg bg-tint object-cover" />
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {post.product ? (
                    <Link href={`/muebles/${post.product.categorySlug}/${post.product.slug}`} className="hover:underline">
                      {post.product.name}
                    </Link>
                  ) : (
                    'Mueble'
                  )}
                </span>
                <span className="rounded-full border border-line bg-white px-3 py-1 text-[12px] font-semibold">
                  {post.status === 'pending' ? 'En revisión' : GALLERY_STATUS_LABELS[post.status]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
