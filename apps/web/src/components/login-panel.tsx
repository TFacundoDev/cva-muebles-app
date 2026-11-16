'use client';

import { type FormEvent, useState } from 'react';
import { errorMessage } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { Notice } from './ui';

/**
 * Pantalla de ingreso. En producción es un solo botón de Google; en modo
 * desarrollo deja entrar con cualquier email para probar sin Supabase.
 */
export function LoginPanel({ ownerHint = false }: { ownerHint?: boolean }) {
  const { mode, signInWithGoogle, signInDev, error } = useAuth();
  const [email, setEmail] = useState(ownerHint ? 'dueno@cva.test' : 'cliente@cva.test');
  const [name, setName] = useState(ownerHint ? 'Dueño de prueba' : 'Clienta de prueba');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure(null);
    try {
      await action();
    } catch (cause) {
      setFailure(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {(failure ?? error) && <Notice kind="error">{failure ?? error}</Notice>}

      {mode === 'supabase' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(signInWithGoogle)}
          className="btn btn-outline w-full"
        >
          {busy ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(() => signInDev(email, name));
          }}
        >
          <Notice>
            Modo desarrollo: entrás con cualquier email, sin contraseña.
            {ownerHint && ' Para ver el panel usá un email que figure en OWNER_EMAILS de la API.'}
          </Notice>
          <div>
            <label htmlFor="dev-email" className="label">
              Email
            </label>
            <input id="dev-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="dev-name" className="label">
              Nombre
            </label>
            <input id="dev-name" required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </div>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  );
}
