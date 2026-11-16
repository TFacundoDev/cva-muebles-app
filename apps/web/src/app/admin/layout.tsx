import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s · Panel CVA' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AdminShell>{children}</AdminShell>
    </AuthProvider>
  );
}
