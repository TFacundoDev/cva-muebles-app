'use client';

import type { MeDto } from '@cva/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { type Api, ApiError, createApi, errorMessage } from './api-client';
import { AUTH_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

// Sesión del usuario. El login lo hace Supabase Auth (con Google); la API solo
// valida el token. Este archivo es el único de la web que conoce a Supabase:
// el resto usa useAuth().

const DEV_TOKEN_KEY = 'cva.dev.token';

interface AuthContextValue {
  status: 'loading' | 'guest' | 'user';
  me: MeDto | null;
  error: string | null;
  mode: 'supabase' | 'dev';
  api: Api;
  signInWithGoogle(): Promise<void>;
  /** Solo en modo desarrollo: entra con cualquier email, sin contraseña. */
  signInDev(email: string, name: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Supabase se descarga recién cuando hace falta, para no cargarlo en la tienda pública.
let supabasePromise: Promise<SupabaseClient> | null = null;
function getSupabase(): Promise<SupabaseClient> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Promise.reject(
      new Error('Falta configurar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    );
  }
  supabasePromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  );
  return supabasePromise;
}

async function getToken(): Promise<string | null> {
  if (AUTH_MODE === 'dev') return window.localStorage.getItem(DEV_TOKEN_KEY);
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [me, setMe] = useState<MeDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = useMemo(() => createApi(getToken), []);

  const refresh = useCallback(async () => {
    try {
      if (!(await getToken())) {
        setMe(null);
        setStatus('guest');
        return;
      }
      setMe(await api.get<MeDto>('/me'));
      setError(null);
      setStatus('user');
    } catch (cause) {
      setMe(null);
      setStatus('guest');
      // Un 401 es simplemente una sesión vencida; lo demás sí conviene mostrarlo.
      if (!(cause instanceof ApiError && cause.status === 401)) setError(errorMessage(cause));
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    if (AUTH_MODE !== 'supabase') return;
    let unsubscribe = () => {};
    getSupabase()
      .then((supabase) => {
        const { data } = supabase.auth.onAuthStateChange(() => {
          // Supabase pide no llamar a su cliente dentro de este callback.
          setTimeout(() => void refresh(), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      })
      .catch(() => undefined);
    return () => unsubscribe();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      me,
      error,
      mode: AUTH_MODE,
      api,
      async signInWithGoogle() {
        const supabase = await getSupabase();
        // Después del login, Google vuelve a la misma página en la que estaba la persona.
        const { error: failure } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.href },
        });
        if (failure) throw failure;
      },
      async signInDev(email, name) {
        const payload = new TextEncoder().encode(JSON.stringify({ email: email.trim(), name: name.trim() }));
        const base64 = btoa(String.fromCharCode(...payload))
          .replaceAll('+', '-')
          .replaceAll('/', '_')
          .replace(/=+$/, '');
        window.localStorage.setItem(DEV_TOKEN_KEY, `dev.${base64}`);
        await refresh();
      },
      async signOut() {
        if (AUTH_MODE === 'dev') window.localStorage.removeItem(DEV_TOKEN_KEY);
        else await (await getSupabase()).auth.signOut();
        setMe(null);
        setStatus('guest');
      },
    }),
    [status, me, error, api, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth se usa dentro de <AuthProvider>');
  return value;
}

/** Carga datos de la API en un componente del panel. */
export function useApiData<T>(path: string | null): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload(): Promise<void>;
  setData(data: T): void;
} {
  const { api } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await api.get<T>(path));
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [api, path]);

  useEffect(() => {
    setLoading(!!path);
    void reload();
  }, [path, reload]);

  return { data, error, loading, reload, setData };
}
