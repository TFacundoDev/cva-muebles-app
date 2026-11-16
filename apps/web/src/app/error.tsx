'use client';

// Se muestra cuando una página falla al cargar (por ejemplo, si la API no responde).
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap flex min-h-[70vh] flex-col items-start justify-center gap-5">
      <span className="eyebrow">Algo salió mal</span>
      <h1 className="text-[34px] md:text-[46px]">No pudimos cargar esta página</h1>
      <p className="max-w-[480px] text-muted">Suele ser algo momentáneo. Probá de nuevo en unos segundos.</p>
      <button type="button" onClick={reset} className="btn btn-primary">
        Reintentar
      </button>
    </main>
  );
}
