'use client';

import {
  type CategoryDto,
  formatDimensions,
  IMAGE_CONTENT_TYPES,
  type ImageDto,
  type ProductAdminDto,
  productInputSchema,
  PRODUCT_STATUS_LABELS,
  type ProductStatus,
} from '@cva/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';
import { Icon, Notice, Spinner } from '../ui';
import { ModelBadge } from './model-badge';
import { ModelStep } from './model-step';

const STEPS = [
  { id: 'datos', label: '1. Datos' },
  { id: 'fotos', label: '2. Fotos' },
  { id: 'modelo', label: '3. Modelo 3D' },
  { id: 'publicar', label: '4. Vista previa y publicar' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

/** Editor de un producto, en cuatro pasos. Con id "nuevo" crea uno. */
export function ProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'nuevo';
  const { api } = useAuth();
  const router = useRouter();
  const categories = useApiData<CategoryDto[]>('/categories');
  const [product, setProduct] = useState<ProductAdminDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>('datos');

  const reload = useCallback(async () => {
    if (isNew) return;
    try {
      setProduct(await api.get<ProductAdminDto>(`/admin/products/${id}`));
    } catch (cause) {
      setLoadError(errorMessage(cause));
    }
  }, [api, id, isNew]);

  useEffect(() => {
    void reload();
    // Después de crear un producto se llega con #fotos para seguir en el paso 2.
    const hash = window.location.hash.slice(1);
    if (STEPS.some((item) => item.id === hash)) setStep(hash as StepId);
  }, [reload]);

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if ((!isNew && !product) || categories.loading) return <Spinner />;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href="/admin/productos" className="flex items-center gap-1 text-[14px] text-acc hover:underline">
          <Icon name="left" size={16} /> Productos
        </Link>
        <h1 className="text-[30px] md:text-[40px]">{product?.name ?? 'Nuevo producto'}</h1>
        {product && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted">
            {PRODUCT_STATUS_LABELS[product.status]}
            <ModelBadge status={product.modelAdmin?.status ?? null} />
          </p>
        )}
      </div>

      <div className="hscroll" role="tablist" aria-label="Pasos">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={step === item.id}
            disabled={isNew && item.id !== 'datos'}
            onClick={() => setStep(item.id)}
            className={`pill disabled:cursor-not-allowed disabled:opacity-40 ${step === item.id ? 'pill-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {isNew && <p className="text-[14px] text-muted">Guardá los datos para poder cargar fotos y el modelo 3D.</p>}

      {step === 'datos' && (
        <DataStep
          product={product}
          categories={categories.data ?? []}
          onSaved={(saved, created) => {
            setProduct(saved);
            if (created) router.replace(`/admin/productos/${saved.id}#fotos`);
          }}
        />
      )}
      {step === 'fotos' && product && <PhotosStep product={product} onChange={setProduct} onNext={() => setStep('modelo')} />}
      {step === 'modelo' && product && <ModelStep product={product} onChange={reload} onNext={() => setStep('publicar')} />}
      {step === 'publicar' && product && <PublishStep product={product} onChange={setProduct} />}
    </>
  );
}

// ---------------------------------------------------------------- Paso 1

function DataStep({
  product,
  categories,
  onSaved,
}: {
  product: ProductAdminDto | null;
  categories: CategoryDto[];
  onSaved(product: ProductAdminDto, created: boolean): void;
}) {
  const { api } = useAuth();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    categoryId: product?.category.id ?? '',
    description: product?.description ?? '',
    price: product?.price != null ? String(product.price) : '',
    widthCm: product?.widthCm != null ? String(product.widthCm) : '',
    depthCm: product?.depthCm != null ? String(product.depthCm) : '',
    heightCm: product?.heightCm != null ? String(product.heightCm) : '',
    woods: product?.woods.join(', ') ?? '',
    materials: product?.materials ?? '',
    featured: product?.featured ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const number = (text: string) => (text.trim() === '' ? null : Number(text.replace(',', '.')));

  async function save(event: FormEvent) {
    event.preventDefault();
    const input = {
      name: form.name,
      categoryId: form.categoryId,
      description: form.description,
      price: number(form.price),
      widthCm: number(form.widthCm),
      depthCm: number(form.depthCm),
      heightCm: number(form.heightCm),
      woods: form.woods.split(',').map((wood) => wood.trim()).filter(Boolean),
      materials: form.materials,
      featured: form.featured,
    };
    // Misma validación que la API (esquema compartido), para avisar antes de enviar.
    const parsed = productInputSchema.omit({ status: true, slug: true }).safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setMessage({ kind: 'error', text: `Revisá "${issue.path.join('.')}": ${issue.message}` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = product
        ? await api.patch<ProductAdminDto>(`/admin/products/${product.id}`, parsed.data)
        : await api.post<ProductAdminDto>('/admin/products', parsed.data);
      onSaved(saved, !product);
      setMessage({ kind: 'ok', text: 'Datos guardados.' });
    } catch (cause) {
      setMessage({ kind: 'error', text: errorMessage(cause) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex max-w-[720px] flex-col gap-5">
      {categories.length === 0 && (
        <Notice>
          Primero creá al menos una categoría en{' '}
          <Link href="/admin/categorias" className="underline">
            Categorías
          </Link>
          .
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="p-nombre" className="label">Nombre</label>
          <input id="p-nombre" required value={form.name} onChange={set('name')} maxLength={120} placeholder="Ej.: Sillón Algarrobo" className="field" />
        </div>
        <div>
          <label htmlFor="p-categoria" className="label">Categoría</label>
          <select id="p-categoria" required value={form.categoryId} onChange={set('categoryId')} className="field">
            <option value="">Elegí una</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="p-descripcion" className="label">Descripción</label>
        <textarea id="p-descripcion" rows={4} value={form.description} onChange={set('description')} maxLength={4000} className="field" />
      </div>

      <fieldset>
        <legend className="label">Medidas en centímetros</legend>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['widthCm', 'Ancho'],
              ['depthCm', 'Profundidad'],
              ['heightCm', 'Alto'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`p-${key}`} className="mb-1 block text-[13px] text-muted">
                {label}
              </label>
              <input id={`p-${key}`} type="number" min={1} max={1000} step={1} inputMode="numeric" value={form[key]} onChange={set(key)} className="field" />
            </div>
          ))}
        </div>
        <p className="hint">
          Importan: con estas medidas se ajusta el modelo 3D al tamaño real, para que en la realidad aumentada el
          mueble se vea del tamaño que tiene.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-maderas" className="label">Maderas</label>
          <input id="p-maderas" value={form.woods} onChange={set('woods')} placeholder="Algarrobo, Lapacho" className="field" />
          <p className="hint">Separadas por coma. Sirven para el filtro del catálogo.</p>
        </div>
        <div>
          <label htmlFor="p-precio" className="label">
            Precio <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input id="p-precio" type="number" min={0} step="any" inputMode="decimal" value={form.price} onChange={set('price')} className="field" />
          <p className="hint">Vacío muestra “Consultar precio”.</p>
        </div>
      </div>
      <div>
        <label htmlFor="p-materiales" className="label">Materiales y terminación</label>
        <input id="p-materiales" value={form.materials} onChange={set('materials')} maxLength={300} placeholder="Algarrobo macizo, laca mate al agua" className="field" />
      </div>
      <label className="flex items-center gap-3 text-[15px]">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={(event) => setForm({ ...form, featured: event.target.checked })}
          className="h-[18px] w-[18px] accent-acc"
        />
        Destacado: aparece en la portada del inicio
      </label>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}
      <div>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Guardando…' : product ? 'Guardar datos' : 'Guardar y seguir con las fotos'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Paso 2

function PhotosStep({
  product,
  onChange,
  onNext,
}: {
  product: ProductAdminDto;
  onChange(product: ProductAdminDto): void;
  onNext(): void;
}) {
  const { api } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/admin/products/${product.id}/images`;
  const setImages = (images: ImageDto[]) =>
    onChange({ ...product, images, coverUrl: images[0]?.url ?? product.modelAdmin?.posterUrl ?? null });

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    let images = product.images;
    try {
      for (const [index, file] of [...files].entries()) {
        setProgress(`Subiendo foto ${index + 1} de ${files.length}…`);
        const key = await api.upload(`${base}/upload-url`, file);
        images = [...images, await api.post<ImageDto>(base, { key })];
        setImages(images);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function run(action: () => Promise<ImageDto[]>) {
    setError(null);
    try {
      setImages(await action());
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const move = (index: number, step: -1 | 1) => {
    const ids = product.images.map((image) => image.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + step, 0, id);
    return run(() => api.put<ImageDto[]>(`${base}/order`, { ids }));
  };

  const remove = (image: ImageDto) =>
    run(async () => {
      await api.del(`${base}/${image.id}`);
      return product.images.filter((item) => item.id !== image.id);
    });

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[640px] text-[14px] text-muted">
        La primera foto es la portada del catálogo. Quedan mejor con el mueble entero y fondo liso. Se convierten
        solas a un formato liviano.
      </p>
      {error && <Notice kind="error">{error}</Notice>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
        {product.images.map((image, index) => (
          <li key={image.id} className="card flex flex-col gap-2 !rounded-xl p-2">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-tint">
              <img src={image.url} alt={`Foto ${index + 1}`} className="h-[84%] w-[84%] object-contain" />
              {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">Portada</span>}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex">
                <button type="button" disabled={index === 0} onClick={() => void move(index, -1)} aria-label="Mover antes" className="flex h-10 w-10 items-center justify-center disabled:opacity-30">
                  <Icon name="left" size={18} />
                </button>
                <button type="button" disabled={index === product.images.length - 1} onClick={() => void move(index, 1)} aria-label="Mover después" className="flex h-10 w-10 items-center justify-center disabled:opacity-30">
                  <Icon name="right" size={18} />
                </button>
              </div>
              <button type="button" onClick={() => void remove(image)} aria-label={`Borrar foto ${index + 1}`} className="flex h-10 w-10 items-center justify-center text-acc">
                <Icon name="trash" size={18} />
              </button>
            </div>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-white p-3 text-center text-[14px] text-muted hover:border-acc"
          >
            <Icon name="up" size={26} />
            {progress ?? 'Agregar fotos'}
          </button>
          <input ref={inputRef} type="file" multiple accept={IMAGE_CONTENT_TYPES.join(',')} className="sr-only" aria-label="Elegir fotos" onChange={(event) => void add(event.target.files)} />
        </li>
      </ul>

      <div>
        <button type="button" onClick={onNext} className="btn btn-outline">
          Seguir con el modelo 3D <Icon name="right" size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Paso 4

function PublishStep({ product, onChange }: { product: ProductAdminDto; onChange(product: ProductAdminDto): void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelStatus = product.modelAdmin?.status ?? null;

  const checks: [boolean, string, string][] = [
    [product.images.length > 0, 'Tiene al menos una foto', 'Sin fotos, la tarjeta del catálogo queda vacía'],
    [
      !!(product.widthCm && product.depthCm && product.heightCm),
      'Tiene las tres medidas',
      'Sin medidas, el modelo 3D no se ajusta al tamaño real',
    ],
    [
      !!product.model,
      'Tiene modelo 3D listo',
      modelStatus === 'error'
        ? 'El modelo 3D dio error: revisá el paso 3'
        : modelStatus
          ? 'El modelo 3D todavía se está procesando'
          : 'Sin modelo 3D se publica igual, solo con fotos',
    ],
  ];

  async function setStatus(status: ProductStatus) {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.patch<ProductAdminDto>(`/admin/products/${product.id}`, { status }));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const publicUrl = `/muebles/${product.category.slug}/${product.slug}`;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
      <div className="w-full max-w-[300px]">
        <p className="mb-2 text-[13px] text-muted">Así se ve en el catálogo:</p>
        <div className="flex flex-col gap-3">
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-tint">
            {product.coverUrl ? (
              <img src={product.coverUrl} alt={product.name} className="h-[76%] w-[76%] object-contain" />
            ) : (
              <Icon name="photo" size={40} className="text-line" />
            )}
            {product.has3d && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white">
                <Icon name="cube" size={14} /> 3D · AR
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px]">{product.name}</span>
            <span className="text-[13px] text-muted">
              {product.category.name}
              {formatDimensions(product.widthCm, product.depthCm, product.heightCm) &&
                ` · ${formatDimensions(product.widthCm, product.depthCm, product.heightCm)}`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5">
        <ul className="flex flex-col gap-2.5">
          {checks.map(([ok, good, bad]) => (
            <li key={good} className="flex items-start gap-3 text-[15px]">
              <Icon name={ok ? 'check' : 'alert'} size={20} className={ok ? 'text-acc' : 'text-muted'} />
              <span className={ok ? '' : 'text-muted'}>{ok ? good : bad}</span>
            </li>
          ))}
        </ul>

        <p>
          Estado actual: <b className="font-medium">{PRODUCT_STATUS_LABELS[product.status]}</b>
          {product.status === 'draft' && <span className="text-muted"> — todavía no se ve en la tienda.</span>}
          {product.status === 'hidden' && <span className="text-muted"> — está cargado pero no se muestra.</span>}
        </p>
        {error && <Notice kind="error">{error}</Notice>}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {product.status !== 'published' ? (
            <button type="button" disabled={busy} onClick={() => void setStatus('published')} className="btn btn-primary">
              Publicar en la tienda
            </button>
          ) : (
            <>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                <Icon name="eye" size={18} /> Ver en la tienda
              </a>
              <button type="button" disabled={busy} onClick={() => void setStatus('hidden')} className="btn btn-outline">
                Ocultar
              </button>
            </>
          )}
          {product.status !== 'draft' && (
            <button type="button" disabled={busy} onClick={() => void setStatus('draft')} className="btn btn-outline">
              Pasar a borrador
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
