'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { LoginPanel } from './login-panel';
import { Spinner } from './ui';

/** Página /ingresar: muestra el login o, si ya entró, a dónde puede ir. */
export function AccountPanel() {
  const { status, me, signOut } = useAuth();
  if (status === 'loading') return <Spinner />;
  if (status === 'guest') {
    return (
      <>
        <p className="text-muted">Entrá con tu cuenta para subir fotos de tus muebles a la galería.</p>
        <LoginPanel />
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p>
        Hola, {me?.displayName}. <span className="text-muted">({me?.email})</span>
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link href="/galeria/subir" className="btn btn-primary">
          Subir una foto
        </Link>
        {me?.role === 'owner' && (
          <Link href="/admin" className="btn btn-outline">
            Ir al panel
          </Link>
        )}
        <button type="button" onClick={() => void signOut()} className="btn btn-outline">
          Salir
        </button>
      </div>
    </div>
  );
}
