// Funciones puras que usan tanto la web como la API.

/** "Sillón Algarrobo" -> "sillon-algarrobo" */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Arma el link de WhatsApp con el mensaje ya escrito.
 * `template` puede usar {producto} y {link}. Sin número devuelve null.
 */
export function buildWhatsAppLink(
  number: string,
  template: string,
  vars: { producto?: string; link?: string } = {},
): string | null {
  const digits = number.replace(/\D/g, '');
  if (!digits) return null;
  const message = template
    .replaceAll('{producto}', vars.producto ?? '')
    .replaceAll('{link}', vars.link ?? '')
    .replace(/\s*\(\s*\)/g, '') // "( )" vacío cuando no hay link
    .replace(/\s{2,}/g, ' ')
    .trim();
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/** "65 × 66 × 78 cm" (ancho × profundidad × alto). Devuelve null si falta todo. */
export function formatDimensions(
  widthCm: number | null,
  depthCm: number | null,
  heightCm: number | null,
): string | null {
  const parts = [widthCm, depthCm, heightCm].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return `${parts.join(' × ')} cm`;
}

export function formatPrice(price: number | null): string {
  if (price == null) return 'Consultar precio';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
