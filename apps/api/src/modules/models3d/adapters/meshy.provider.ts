import { Logger } from '@nestjs/common';
import { type AiInputImage, type AiModelProvider, ModelProcessingError } from '../ports.js';

const BASE = 'https://api.meshy.ai/openapi/v1';
const POLL_MS = 8000;
const TIMEOUT_MS = 20 * 60 * 1000;

interface MeshyTask {
  status: string;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

/**
 * ADAPTADOR: Meshy (https://docs.meshy.ai/api/image-to-3d).
 * Crea la tarea, consulta cada unos segundos hasta que termina y baja el .glb.
 * Con una foto usa image-to-3d; con varias, multi-image-to-3d.
 *
 * OJO: cada generación consume créditos pagos de Meshy.
 */
export class MeshyProvider implements AiModelProvider {
  readonly enabled = true;
  private readonly logger = new Logger(MeshyProvider.name);

  constructor(private readonly apiKey: string) {}

  async generateFromImages(images: AiInputImage[]): Promise<Buffer> {
    const dataUris = images.map(
      (image) => `data:${image.contentType};base64,${image.data.toString('base64')}`,
    );
    const endpoint = dataUris.length === 1 ? 'image-to-3d' : 'multi-image-to-3d';
    const body =
      dataUris.length === 1
        ? { image_url: dataUris[0], should_texture: true, target_formats: ['glb'] }
        : { image_urls: dataUris, should_texture: true, target_formats: ['glb'] };

    const created = await this.request<{ result?: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!created.result) throw new ModelProcessingError('El servicio de IA no aceptó las fotos.');
    this.logger.log(`Tarea de IA creada: ${created.result}`);

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const task = await this.request<MeshyTask>(`${endpoint}/${created.result}`, { method: 'GET' });
      if (task.status === 'SUCCEEDED') {
        const url = task.model_urls?.glb;
        if (!url) throw new ModelProcessingError('El servicio de IA no devolvió el modelo.');
        const file = await fetch(url, { signal: AbortSignal.timeout(120_000) });
        if (!file.ok) throw new ModelProcessingError('No se pudo descargar el modelo generado.');
        return Buffer.from(await file.arrayBuffer());
      }
      if (task.status === 'FAILED' || task.status === 'CANCELED') {
        const reason = task.task_error?.message ? ` (${task.task_error.message})` : '';
        throw new ModelProcessingError(`La IA no pudo generar el modelo${reason}. Probá con otras fotos.`);
      }
    }
    throw new ModelProcessingError('La generación con IA tardó demasiado. Probá de nuevo más tarde.');
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Meshy respondió ${response.status}: ${text.slice(0, 300)}`);
      if (response.status === 401) throw new ModelProcessingError('La clave del servicio de IA no es válida.');
      if (response.status === 402) throw new ModelProcessingError('No quedan créditos en el servicio de IA.');
      throw new ModelProcessingError('El servicio de IA no respondió bien. Probá de nuevo más tarde.');
    }
    return (await response.json()) as T;
  }
}

/** Sin proveedor configurado: el panel esconde la opción de IA. */
export class DisabledAiProvider implements AiModelProvider {
  readonly enabled = false;

  async generateFromImages(): Promise<Buffer> {
    throw new ModelProcessingError('La generación con IA no está configurada.');
  }
}
