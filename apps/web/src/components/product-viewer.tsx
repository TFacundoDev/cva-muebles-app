'use client';

import type { ImageDto, ModelPublicDto } from '@cva/shared';
import { formatBytes } from '@cva/shared';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { loadModelViewer } from '@/lib/model-viewer';
import type { ModelViewerElement } from '@/types/model-viewer';
import { Icon } from './ui';

// La ficha tiene dos piezas que necesitan hablarse: el visor (columna izquierda)
// y el botón "Ver en mi casa" (columna derecha). Comparten este contexto.

interface ViewerContextValue {
  model: ModelPublicDto | null;
  show3d: boolean;
  setShow3d(value: boolean): void;
  register(element: ModelViewerElement | null): void;
  /** Muestra el visor y espera a que el modelo termine de cargar. */
  prepare(): Promise<boolean>;
  /** Abre la realidad aumentada. Devuelve un mensaje si el dispositivo no puede. */
  activateAr(): string | null;
  isLoaded(): boolean;
}

const ViewerContext = createContext<ViewerContextValue | null>(null);

function useViewer(): ViewerContextValue {
  const value = useContext(ViewerContext);
  if (!value) throw new Error('Falta <ViewerProvider>');
  return value;
}

function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (condition()) return resolve(true);
      if (Date.now() - started > timeoutMs) return resolve(false);
      setTimeout(tick, 150);
    };
    tick();
  });
}

export function ViewerProvider({ model, children }: { model: ModelPublicDto | null; children: ReactNode }) {
  const [show3d, setShow3d] = useState(false);
  const elementRef = useRef<ModelViewerElement | null>(null);

  const register = useCallback((element: ModelViewerElement | null) => {
    elementRef.current = element;
  }, []);

  const isLoaded = useCallback(() => !!elementRef.current?.loaded, []);

  const prepare = useCallback(async (): Promise<boolean> => {
    setShow3d(true);
    // El modelo se descarga recién ahora: hay que esperar a que esté listo.
    return waitFor(() => !!elementRef.current?.loaded, 45_000);
  }, []);

  const activateAr = useCallback((): string | null => {
    const element = elementRef.current;
    if (!element?.loaded) return 'El modelo todavía no terminó de cargar.';
    if (!element.canActivateAR) {
      return 'Este dispositivo no puede mostrar realidad aumentada. Abrí esta página desde un celular: Chrome en Android o Safari en iPhone.';
    }
    void element.activateAR();
    return null;
  }, []);

  const value = useMemo(
    () => ({ model, show3d, setShow3d, register, prepare, activateAr, isLoaded }),
    [model, show3d, register, prepare, activateAr, isLoaded],
  );
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

/** Visor de la ficha: fotos y, si hay modelo, la vista 3D que se puede girar. */
export function ProductStage({ name, images }: { name: string; images: ImageDto[] }) {
  const { model, show3d, setShow3d, register } = useViewer();
  const [photo, setPhoto] = useState(0);
  const [libraryReady, setLibraryReady] = useState(false);
  const poster = model?.posterUrl ?? images[0]?.url;

  // La librería del visor pesa: se baja solo cuando alguien pide ver el 3D.
  useEffect(() => {
    if (show3d && !libraryReady) {
      void loadModelViewer().then(() => setLibraryReady(true));
    }
  }, [show3d, libraryReady]);

  const thumb = (active: boolean) =>
    `flex h-[68px] w-[68px] flex-none items-center justify-center overflow-hidden rounded-xl border-2 md:h-[84px] md:w-[84px] ${
      active ? 'border-acc' : 'border-line hover:border-muted'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[20px] bg-tint">
        {show3d && model ? (
          <>
            {libraryReady ? (
              <model-viewer
                ref={register}
                src={model.glbUrl}
                poster={poster}
                alt={`Modelo 3D de ${name}`}
                ar
                ar-modes="webxr scene-viewer quick-look"
                ar-scale="fixed"
                camera-controls
                touch-action="pan-y"
                shadow-intensity="1"
                shadow-softness="0.9"
                interaction-prompt="none"
              />
            ) : (
              <span className="text-[14px] text-muted">Cargando el visor…</span>
            )}
            <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-white md:left-4 md:top-4">
              <Icon name="rotate" size={16} /> Arrastrá para girar
            </span>
          </>
        ) : images[photo] ? (
          <img src={images[photo].url} alt={name} className="h-[76%] w-[76%] object-contain" />
        ) : poster ? (
          <img src={poster} alt={name} className="h-[76%] w-[76%] object-contain" />
        ) : (
          <Icon name="photo" size={48} className="text-line" />
        )}

        {model && !show3d && (
          <button
            type="button"
            onClick={() => setShow3d(true)}
            className="btn absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap border-ink bg-ink text-white hover:bg-acc hover:border-acc md:bottom-4"
          >
            <Icon name="cube" size={18} /> Ver en 3D
            {model.sizeBytes ? <span className="text-[12px] opacity-70">({formatBytes(model.sizeBytes)})</span> : null}
          </button>
        )}
      </div>

      {(images.length > 1 || model) && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => {
                setPhoto(index);
                setShow3d(false);
              }}
              aria-label={`Ver foto ${index + 1}`}
              aria-pressed={!show3d && photo === index}
              className={`${thumb(!show3d && photo === index)} bg-tint`}
            >
              <img src={image.url} alt="" className="h-[70%] w-[70%] object-contain" />
            </button>
          ))}
          {model && (
            <button
              type="button"
              onClick={() => setShow3d(true)}
              aria-label="Ver el modelo 3D"
              aria-pressed={show3d}
              className={`${thumb(show3d)} bg-white text-muted ${show3d ? '' : 'border-dashed'}`}
            >
              <Icon name="cube" size={26} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Botón "Ver en mi casa": abre la cámara y apoya el mueble en el piso, a tamaño real.
 *
 * Los navegadores solo dejan abrir la cámara como respuesta directa a un toque.
 * Si el modelo todavía no estaba cargado, el primer toque lo descarga y el
 * segundo abre la cámara.
 */
export function ArButton() {
  const { model, prepare, activateAr, isLoaded } = useViewer();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [inAppBrowser, setInAppBrowser] = useState(false);

  // Instagram, Facebook y TikTok abren los links en un navegador propio que bloquea la cámara.
  useEffect(() => {
    setInAppBrowser(/Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\//i.test(navigator.userAgent));
  }, []);

  if (!model) return null;

  async function handleClick() {
    setMessage(null);
    if (isLoaded()) {
      setMessage(activateAr());
      return;
    }
    setPhase('loading');
    const loaded = await prepare();
    if (!loaded) {
      setPhase('idle');
      setMessage('El modelo tardó demasiado en cargar. Probá de nuevo con mejor conexión.');
      return;
    }
    setPhase('ready');
    setMessage('El modelo ya está listo. Tocá de nuevo para abrir la cámara.');
  }

  const label =
    phase === 'loading' ? 'Preparando el modelo…' : phase === 'ready' ? 'Abrir la cámara' : 'Ver en mi casa (AR)';

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        disabled={phase === 'loading'}
        onClick={() => void handleClick()}
        className="btn btn-primary w-full"
      >
        <Icon name="home" size={18} /> {label}
      </button>
      {inAppBrowser && (
        <p className="text-[13px] text-muted">
          Para verlo en tu casa, abrí este link en tu navegador: tocá los tres puntos y elegí “Abrir en el
          navegador”.
        </p>
      )}
      {message && (
        <p role="status" className="text-[13px] text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
