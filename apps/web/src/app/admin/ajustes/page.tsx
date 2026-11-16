'use client';

import { buildWhatsAppLink, settingsSchema, type StoreSettings } from '@cva/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { Notice, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiData, useAuth } from '@/lib/auth';

/** Datos del local que se muestran en la tienda: contacto, dirección, mapa y textos. */
export default function AdminSettingsPage() {
  const { api } = useAuth();
  const settings = useApiData<StoreSettings>('/settings/public');
  const [form, setForm] = useState<StoreSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [backup, setBackup] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data && !form) setForm(settings.data);
  }, [settings.data, form]);

  if (settings.loading || !form) {
    return settings.error ? <Notice kind="error">{settings.error}</Notice> : <Spinner />;
  }

  const set = (key: keyof StoreSettings) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    // La misma validación que hace la API, para avisar antes de enviar.
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) {
      setMessage({ kind: 'error', text: parsed.error.issues.map((issue) => issue.message).join('. ') });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      setForm(await api.patch<StoreSettings>('/admin/settings', parsed.data));
      setMessage({ kind: 'ok', text: 'Cambios guardados. La tienda ya muestra los datos nuevos.' });
    } catch (cause) {
      setMessage({ kind: 'error', text: errorMessage(cause) });
    } finally {
      setSaving(false);
    }
  }

  const sample = buildWhatsAppLink(form.whatsappNumber, form.whatsappMessage, {
    producto: 'Sillón Algarrobo',
    link: 'https://…/sillon-algarrobo',
  });

  return (
    <>
      <h1 className="text-[34px] md:text-[40px]">Ajustes del local</h1>
      <form onSubmit={(event) => void save(event)} className="flex max-w-[720px] flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-serif text-[24px]">Negocio</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-nombre" className="label">Nombre</label>
              <input id="s-nombre" value={form.storeName} onChange={set('storeName')} maxLength={60} className="field" />
            </div>
            <div>
              <label htmlFor="s-bajada" className="label">Bajada del logo</label>
              <input id="s-bajada" value={form.tagline} onChange={set('tagline')} maxLength={80} className="field" />
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-serif text-[24px]">WhatsApp</legend>
          <div>
            <label htmlFor="s-wa" className="label">Número</label>
            <input id="s-wa" inputMode="numeric" value={form.whatsappNumber} onChange={set('whatsappNumber')} placeholder="5493794123456" className="field" />
            <p className="hint">Con código de país y de área, solo números. Para Corrientes: 549 + 379 + el número sin el 15.</p>
          </div>
          <div>
            <label htmlFor="s-wa-msg" className="label">Mensaje que sale escrito</label>
            <textarea id="s-wa-msg" rows={2} value={form.whatsappMessage} onChange={set('whatsappMessage')} maxLength={300} className="field" />
            <p className="hint">
              Usá {'{producto}'} y {'{link}'}: se reemplazan por el nombre del mueble y el link a su ficha.
            </p>
          </div>
          {sample && (
            <Notice>
              Así le llega al local: “{decodeURIComponent(sample.split('text=')[1] ?? '')}”
            </Notice>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-serif text-[24px]">Ubicación y horarios</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-dir" className="label">Dirección</label>
              <input id="s-dir" value={form.address} onChange={set('address')} maxLength={160} placeholder="Calle y número" className="field" />
            </div>
            <div>
              <label htmlFor="s-ciudad" className="label">Ciudad</label>
              <input id="s-ciudad" value={form.city} onChange={set('city')} maxLength={80} className="field" />
            </div>
          </div>
          <div>
            <label htmlFor="s-horarios" className="label">Horarios</label>
            <input id="s-horarios" value={form.hours} onChange={set('hours')} maxLength={160} placeholder="Lunes a sábado de 9 a 13 y de 17 a 21" className="field" />
          </div>
          <div>
            <label htmlFor="s-mapa-link" className="label">Link de “Cómo llegar”</label>
            <input id="s-mapa-link" type="url" value={form.mapLink} onChange={set('mapLink')} placeholder="https://maps.app.goo.gl/…" className="field" />
            <p className="hint">En Google Maps: Compartir → Copiar vínculo.</p>
          </div>
          <div>
            <label htmlFor="s-mapa" className="label">Mapa embebido</label>
            <input id="s-mapa" type="url" value={form.mapEmbedUrl} onChange={set('mapEmbedUrl')} placeholder="https://www.google.com/maps/embed?pb=…" className="field" />
            <p className="hint">
              En Google Maps: Compartir → Insertar un mapa → copiá solo la dirección que está entre comillas después
              de src=.
            </p>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-3 font-serif text-[24px]">El taller</legend>
          <div>
            <label htmlFor="s-about-t" className="label">Título</label>
            <input id="s-about-t" value={form.aboutTitle} onChange={set('aboutTitle')} maxLength={100} className="field" />
          </div>
          <div>
            <label htmlFor="s-about" className="label">Historia del taller</label>
            <textarea id="s-about" rows={6} value={form.aboutText} onChange={set('aboutText')} maxLength={1500} className="field" />
            <p className="hint">Si lo dejás vacío, esa sección no aparece en el inicio. Dejá una línea en blanco entre párrafos.</p>
          </div>
        </fieldset>

        {message && <Notice kind={message.kind}>{message.text}</Notice>}
        <div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>

      <section className="flex max-w-[720px] flex-col gap-3 border-t border-line pt-8">
        <h2 className="text-[24px]">Copia de seguridad</h2>
        <p className="text-[14px] text-muted">
          Se hace sola una vez por semana. También podés pedir una ahora, por ejemplo antes de borrar muchos productos.
        </p>
        <div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              setBackup('Haciendo la copia…');
              try {
                const result = await api.post<{ file: string | null }>('/admin/backup');
                setBackup(
                  result.file
                    ? `Copia guardada: ${result.file}`
                    : 'Las copias están apagadas: falta configurar el bucket privado (R2_BACKUP_BUCKET).',
                );
              } catch (cause) {
                setBackup(errorMessage(cause));
              }
            }}
          >
            Hacer una copia ahora
          </button>
        </div>
        {backup && <p role="status" className="text-[14px] text-muted">{backup}</p>}
      </section>
    </>
  );
}
