import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="wrap flex min-h-[70vh] flex-col items-start justify-center gap-5">
      <span className="eyebrow">Error 404</span>
      <h1 className="text-[34px] md:text-[46px]">No encontramos esa página</h1>
      <p className="max-w-[480px] text-muted">
        Puede que el mueble ya no esté en el catálogo o que el link esté mal escrito.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/muebles" className="btn btn-primary">
          Ver el catálogo
        </Link>
        <Link href="/" className="btn btn-outline">
          Ir al inicio
        </Link>
      </div>
    </main>
  );
}
