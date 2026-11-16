'use client';

import type { CategoryDto } from '@cva/shared';
import { type FormEvent, useState } from 'react';
import { Icon, Notice, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';

export default function AdminCategoriesPage() {
  const { api } = useAuth();
  const categories = useApiData<CategoryDto[]>('/categories');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await categories.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  const list = categories.data ?? [];

  /** Intercambia el orden de dos categorías vecinas. */
  const move = (index: number, step: -1 | 1) => {
    const reordered = [...list];
    const [item] = reordered.splice(index, 1);
    reordered.splice(index + step, 0, item);
    return run(() =>
      Promise.all(
        reordered.map((category, position) =>
          category.sortOrder === position
            ? null
            : api.patch(`/admin/categories/${category.id}`, { sortOrder: position }),
        ),
      ),
    );
  };

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Categorías</h1>
      <p className="max-w-[640px] text-[14px] text-muted">
        Así se agrupan los muebles en el catálogo. El orden de esta lista es el orden en que aparecen en la tienda.
      </p>

      <form
        className="flex max-w-[520px] gap-2"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!name.trim()) return;
          void run(async () => {
            await api.post('/admin/categories', { name: name.trim() });
            setName('');
          });
        }}
      >
        <label htmlFor="nueva-categoria" className="sr-only">
          Nombre de la categoría nueva
        </label>
        <input
          id="nueva-categoria"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nueva categoría, ej.: Exterior"
          className="field !rounded-full !px-5"
        />
        <button type="submit" className="btn btn-primary flex-none">
          Agregar
        </button>
      </form>

      {(error ?? categories.error) && <Notice kind="error">{error ?? categories.error}</Notice>}

      {categories.loading ? (
        <Spinner />
      ) : (
        <ul className="card max-w-[720px] overflow-hidden">
          {list.length === 0 && <li className="p-6 text-muted">Todavía no hay categorías.</li>}
          {list.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              {editing?.id === category.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await api.patch(`/admin/categories/${category.id}`, { name: editing.name.trim() });
                      setEditing(null);
                    });
                  }}
                >
                  <input
                    aria-label="Nombre de la categoría"
                    autoFocus
                    value={editing.name}
                    maxLength={60}
                    onChange={(event) => setEditing({ id: category.id, name: event.target.value })}
                    className="field"
                  />
                  <button type="submit" className="btn btn-primary flex-none">
                    Guardar
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className="btn btn-outline flex-none">
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span>{category.name}</span>
                    <span className="text-[13px] text-muted">/muebles/{category.slug}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => void move(index, -1)}
                      aria-label={`Subir ${category.name}`}
                      className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                    >
                      <Icon name="down" size={18} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      disabled={index === list.length - 1}
                      onClick={() => void move(index, 1)}
                      aria-label={`Bajar ${category.name}`}
                      className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                    >
                      <Icon name="down" size={18} />
                    </button>
                  </div>
                  <div className="flex gap-4 text-[14px] text-acc">
                    <button type="button" onClick={() => setEditing({ id: category.id, name: category.name })} className="hover:underline">
                      Renombrar
                    </button>
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        if (window.confirm(`¿Borrar la categoría "${category.name}"?`)) {
                          void run(() => api.del(`/admin/categories/${category.id}`));
                        }
                      }}
                    >
                      Borrar
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
