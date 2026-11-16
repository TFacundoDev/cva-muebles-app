'use client';

import {
  formatBytes,
  IMAGE_CONTENT_TYPES,
  MAX_AI_IMAGES,
  MAX_MODEL_UPLOAD_BYTES,
  MODEL_SOURCE_LABELS,
  type ModelAdminDto,
  type ModelSourceKind,
  type ProductAdminDto,
} from '@cva/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';
import { loadModelViewer } from '@/lib/model-viewer';
import type { ModelViewerElement } from '@/types/model-viewer';
import { Icon, Notice } from '../ui';

const TABS: { id: ModelSourceKind; label: string }[] = [
  { id: 'upload', label: 'Subir archivo' },
  { id: 'scan', label: 'Escanear con el celular' },
  { id: 'ai', label: 'Generar desde fotos' },
  { id: 'custom', label: 'Modelado a medida' },
];

/**
 * Paso 3 del editor: conseguir el modelo 3D por cualquiera de los cuatro
 * orígenes. Todos terminan igual: un .glb que la API procesa en segundo plano.
 */
export function ModelStep({
  product,
  onChange,
  onNext,
}: {
  product: ProductAdminDto;
  onChange(): Promise<void>;
  onNext(): void;
}) {
  const { api } = useAuth();
  const capabilities = useApiData<{ ai: boolean }>('/admin/model-capabilities');
  const [tab, setTab] = useState<ModelSourceKind>('upload');
  const [model, setModel] = useState<ModelAdminDto | null>(product.modelAdmin);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiFiles, setAiFiles] = useState<File[]>([]);
  const base = `/admin/products/${product.id}/model`;
  const working = model?.status === 'pending' || model?.status === 'processing';
  const hasDimensions = !!(product.widthCm && product.depthCm && product.heightCm);

  // Mientras la API procesa, se consulta el estado cada 2 segundos.
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(async () => {
      try {
        const next = await api.get<ModelAdminDto>(base);
        setModel(next);
        if (next.status === 'ready' || next.status === 'error') await onChange();
      } catch {
        // Un fallo de red momentáneo: se vuelve a intentar en la próxima vuelta.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [working, api, base, onChange]);

  async function start(action: () => Promise<ModelAdminDto>) {
    setError(null);
    try {
      setModel(await action());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProgress(null);
    }
  }

  const uploadModel = (file: File | undefined, source: ModelSourceKind) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb')) {
      return setError('El archivo tiene que ser .glb (glTF binario). Si tenés un .gltf, .obj o .fbx, exportalo como GLB.');
    }
    if (file.size > MAX_MODEL_UPLOAD_BYTES) return setError('El archivo pesa más de 100 MB.');
    return start(async () => {
      const key = await api.upload(`${base}/upload-url`, file, { kind: 'model' }, (fraction) =>
        setProgress(`Subiendo… ${Math.round(fraction * 100)}%`),
      );
      setProgress('Registrando…');
      return api.post<ModelAdminDto>(base, { source, key });
    });
  };

  const generateWithAi = () =>
    start(async () => {
      const imageKeys: string[] = [];
      for (const [index, file] of aiFiles.entries()) {
        setProgress(`Subiendo foto ${index + 1} de ${aiFiles.length}…`);
        imageKeys.push(await api.upload(`${base}/upload-url`, file, { kind: 'image' }));
      }
      setProgress('Pidiendo el modelo…');
      const result = await api.post<ModelAdminDto>(base, { source: 'ai', imageKeys });
      setAiFiles([]);
      return result;
    });

  const removeModel = async () => {
    if (!window.confirm('¿Quitar el modelo 3D de este producto?')) return;
    setError(null);
    try {
      await api.del(base);
      setModel(null);
      await onChange();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const picker = (source: ModelSourceKind, label: string) => (
    <label className={`btn btn-primary w-full sm:w-auto sm:self-start ${working || progress ? 'pointer-events-none opacity-50' : ''}`}>
      <Icon name="up" size={18} /> {progress ?? label}
      <input
        type="file"
        accept=".glb,model/gltf-binary"
        className="sr-only"
        disabled={working || !!progress}
        onChange={(event) => {
          void uploadModel(event.target.files?.[0], source);
          event.target.value = '';
        }}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      {!hasDimensions && (
        <Notice>
          Este producto no tiene las tres medidas cargadas. El modelo se va a publicar con el tamaño que traiga el
          archivo, que puede no ser el real. Cargalas en el paso 1 antes de subir el modelo.
        </Notice>
      )}

      {/* Estado del modelo actual */}
      {model && (
        <section className="card flex flex-col gap-4 p-4 md:flex-row md:p-5">
          {model.glbUrl && (
            <ModelPreview
              key={model.glbUrl}
              productId={product.id}
              name={product.name}
              glbUrl={model.glbUrl}
              hasPoster={!!model.posterUrl}
              onPoster={setModel}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h2 className="text-[22px]">
              {working ? 'Procesando el modelo…' : model.status === 'error' ? 'El último modelo falló' : 'Modelo publicado'}
            </h2>
            <p className="text-[14px] text-muted">
              Origen: {MODEL_SOURCE_LABELS[model.source]}
              {model.sizeBytes ? ` · ${formatBytes(model.sizeBytes)}` : ''}
            </p>
            {working && (
              <Notice>
                {model.source === 'ai'
                  ? 'La IA está generando el modelo. Puede tardar varios minutos; podés cerrar esta página y volver después.'
                  : 'Lo estamos validando, ajustando al tamaño real y comprimiendo. Suele tardar menos de un minuto.'}
              </Notice>
            )}
            {model.status === 'error' && (
              <Notice kind="error">
                {model.error}
                {model.glbUrl && ' Sigue publicado el modelo anterior.'}
              </Notice>
            )}
            {model.status === 'ready' && model.warning && <Notice>{model.warning}</Notice>}
            {model.status === 'ready' && !model.warning && (
              <Notice kind="ok">Listo: se ve en la ficha y se puede probar en realidad aumentada.</Notice>
            )}
            {!working && (
              <div>
                <button type="button" onClick={() => void removeModel()} className="text-[14px] text-acc hover:underline">
                  Quitar el modelo
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {error && <Notice kind="error">{error}</Notice>}

      {/* Orígenes */}
      <section className="flex flex-col gap-4">
        <h2 className="text-[22px]">{model?.glbUrl ? 'Reemplazar el modelo' : 'Cargar el modelo'}</h2>
        <div className="hscroll" role="tablist" aria-label="Origen del modelo">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => {
                setTab(item.id);
                setError(null);
              }}
              className={`pill ${tab === item.id ? 'pill-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex max-w-[680px] flex-col gap-4 text-[15px]">
          {tab === 'upload' && (
            <>
              <p className="text-muted">Si ya tenés el modelo en un archivo .glb, subilo directo. Hasta 100 MB.</p>
              {picker('upload', 'Elegir archivo .glb')}
            </>
          )}

          {tab === 'scan' && (
            <>
              <p className="text-muted">
                Con una app de escaneo sacás el modelo del mueble real, con su veta y su color. Sirven Polycam,
                Scaniverse o KIRI Engine.
              </p>
              <ol className="flex list-decimal flex-col gap-2 pl-5">
                <li>Poné el mueble en un lugar con luz pareja y espacio para caminar alrededor.</li>
                <li>En la app, elegí el modo de escaneo de objetos y rodealo despacio: una vuelta a media altura, otra desde arriba y otra desde abajo.</li>
                <li>Recortá el piso y lo que haya quedado alrededor.</li>
                <li>Exportá en formato <b className="font-medium">GLB</b> y pasá el archivo a este dispositivo.</li>
                <li>Subilo acá. Las medidas del paso 1 corrigen el tamaño.</li>
              </ol>
              {picker('scan', 'Subir el escaneo .glb')}
            </>
          )}

          {tab === 'ai' &&
            (capabilities.data?.ai ? (
              <>
                <p className="text-muted">
                  Subí de 1 a {MAX_AI_IMAGES} fotos del mueble entero, de distintos lados y con fondo liso. Un servicio
                  de IA arma el modelo. El resultado puede inventar detalles: revisalo antes de publicar.
                </p>
                <Notice>Cada generación consume créditos pagos del servicio de IA. Se lanza solo cuando tocás el botón.</Notice>
                <label className="btn btn-outline w-full sm:w-auto sm:self-start">
                  <Icon name="photo" size={18} />
                  {aiFiles.length ? `${aiFiles.length} ${aiFiles.length === 1 ? 'foto elegida' : 'fotos elegidas'}` : 'Elegir fotos'}
                  <input
                    type="file"
                    multiple
                    accept={IMAGE_CONTENT_TYPES.join(',')}
                    className="sr-only"
                    onChange={(event) => setAiFiles([...(event.target.files ?? [])].slice(0, MAX_AI_IMAGES))}
                  />
                </label>
                <button
                  type="button"
                  disabled={aiFiles.length === 0 || working || !!progress}
                  onClick={() => void generateWithAi()}
                  className="btn btn-primary w-full sm:w-auto sm:self-start"
                >
                  {progress ?? 'Generar modelo con IA'}
                </button>
              </>
            ) : (
              <Notice>
                La generación con IA no está activada. Para usarla hay que contratar un servicio (Meshy) y cargar su
                clave en la configuración de la API (AI_PROVIDER y MESHY_API_KEY).
              </Notice>
            ))}

          {tab === 'custom' && (
            <>
              <p className="text-muted">
                Si alguien modeló el mueble por encargo (en Blender u otro programa), pedile el archivo en formato
                GLB, con el eje Y hacia arriba, y subilo acá. Es la opción con medidas más exactas.
              </p>
              {picker('custom', 'Subir el modelo .glb')}
            </>
          )}
        </div>
      </section>

      <div>
        <button type="button" onClick={onNext} className="btn btn-outline">
          Seguir con la vista previa <Icon name="right" size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Muestra el modelo publicado y saca la foto de portada desde el propio visor,
 * así el servidor no tiene que dibujar nada.
 */
function ModelPreview({
  productId,
  name,
  glbUrl,
  hasPoster,
  onPoster,
}: {
  productId: string;
  name: string;
  glbUrl: string;
  hasPoster: boolean;
  onPoster(model: ModelAdminDto): void;
}) {
  const { api } = useAuth();
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoDone = useRef(false);

  useEffect(() => {
    void loadModelViewer().then(() => setReady(true));
  }, []);

  const capture = useCallback(async () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setState('saving');
    try {
      const blob = await viewer.toBlob({ mimeType: 'image/png', idealAspect: true });
      const file = new File([blob], 'portada.png', { type: 'image/png' });
      const key = await api.upload(`/admin/products/${productId}/model/upload-url`, file, { kind: 'image' });
      onPoster(await api.post<ModelAdminDto>(`/admin/products/${productId}/model/poster`, { key }));
      setState('saved');
    } catch {
      setState('error');
    }
  }, [api, productId, onPoster]);

  // Un modelo recién procesado no tiene portada: se saca sola cuando termina de cargar.
  const onLoad = useCallback(() => {
    if (hasPoster || autoDone.current) return;
    autoDone.current = true;
    setTimeout(() => void capture(), 600);
  }, [hasPoster, capture]);

  const setViewer = useCallback(
    (element: ModelViewerElement | null) => {
      viewerRef.current?.removeEventListener('load', onLoad);
      viewerRef.current = element;
      element?.addEventListener('load', onLoad);
    },
    [onLoad],
  );

  return (
    <div className="flex w-full flex-none flex-col gap-2 md:w-[300px]">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-tint">
        {ready ? (
          <model-viewer ref={setViewer} src={glbUrl} alt={`Modelo 3D de ${name}`} camera-controls touch-action="pan-y" shadow-intensity="1" interaction-prompt="none" />
        ) : (
          <span className="text-[14px] text-muted">Cargando el visor…</span>
        )}
      </div>
      <button type="button" disabled={state === 'saving'} onClick={() => void capture()} className="text-left text-[14px] text-acc hover:underline disabled:opacity-50">
        {state === 'saving' ? 'Guardando la portada…' : 'Usar esta vista como portada del modelo'}
      </button>
      {state === 'saved' && <span className="text-[13px] text-muted">Portada guardada.</span>}
      {state === 'error' && <span className="text-[13px] text-muted">No se pudo guardar la portada. Probá de nuevo.</span>}
    </div>
  );
}
