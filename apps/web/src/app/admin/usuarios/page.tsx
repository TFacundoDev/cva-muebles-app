'use client';

import type { UserAdminDto } from '@cva/shared';
import { Notice, Spinner } from '@/components/ui';
import { useApiData } from '@/lib/auth';

/** Usuarios: por ahora es solo de lectura. */
export default function AdminUsersPage() {
  const users = useApiData<UserAdminDto[]>('/admin/users');

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Usuarios</h1>
      <p className="max-w-[640px] text-[14px] text-muted">
        Personas que entraron con su cuenta. El rol de dueño no se cambia desde acá: sale de la lista de emails
        OWNER_EMAILS en la configuración de la API.
      </p>
      {users.error && <Notice kind="error">{users.error}</Notice>}
      {users.loading ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <thead>
              <tr className="text-left text-[12px] uppercase tracking-[.1em] text-muted">
                <th className="px-4 py-3.5 font-medium">Nombre</th>
                <th className="px-4 py-3.5 font-medium">Email</th>
                <th className="px-4 py-3.5 font-medium">Rol</th>
                <th className="px-4 py-3.5 font-medium">Fotos subidas</th>
                <th className="px-4 py-3.5 font-medium">Desde</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((user) => (
                <tr key={user.id} className="border-t border-line">
                  <td className="px-4 py-3">{user.displayName}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">{user.role === 'owner' ? 'Dueño' : 'Cliente'}</td>
                  <td className="px-4 py-3 tabular-nums">{user.galleryPosts}</td>
                  <td className="px-4 py-3 text-muted">{new Date(user.createdAt).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
