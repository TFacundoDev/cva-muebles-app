import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';

// Las páginas de este grupo necesitan sesión. El resto de la tienda no carga
// nada de login, así queda más liviana.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
