import type { ApiErrorBody, UploadTicketDto } from '@cva/shared';
import { PUBLIC_API_URL } from './env';

// Cliente de la API para el navegador (panel del dueño y subida de fotos).
// Manda el token de la sesión en cada pedido.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }

  /** Mensaje listo para mostrar: incluye el detalle de validación si lo hay. */
  get full(): string {
    return this.details.length ? `${this.message}: ${this.details.join('; ')}` : this.message;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.full;
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado';
}

export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  del(path: string): Promise<void>;
  /** Sube un archivo en dos pasos: pide la URL firmada y sube directo al almacenamiento. */
  upload(
    ticketPath: string,
    file: Blob,
    extra?: Record<string, unknown>,
    onProgress?: (fraction: number) => void,
  ): Promise<string>;
}

export function createApi(getToken: () => Promise<string | null>): Api {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    let response: Response;
    try {
      response = await fetch(`${PUBLIC_API_URL}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Revisá tu conexión');
    }
    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
    if (!response.ok) {
      throw new ApiError(response.status, data?.message ?? `Error ${response.status}`, data?.details);
    }
    return data as T;
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    patch: (path, body) => request('PATCH', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path) => request<void>('DELETE', path),

    async upload(ticketPath, file, extra = {}, onProgress) {
      const ticket = await request<UploadTicketDto>('POST', ticketPath, {
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        ...extra,
      });
      await putWithProgress(ticket, file, onProgress);
      return ticket.key;
    },
  };
}

/** fetch no informa el avance de una subida; XMLHttpRequest sí. */
function putWithProgress(
  ticket: UploadTicketDto,
  file: Blob,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(ticket.method, ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, 'No se pudo subir el archivo. Probá de nuevo'));
    xhr.onerror = () => reject(new ApiError(0, 'Se cortó la subida. Revisá tu conexión'));
    xhr.send(file);
  });
}
