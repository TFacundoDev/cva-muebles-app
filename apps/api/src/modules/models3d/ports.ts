import type { ModelSourceKind } from '@cva/shared';

/** Lo que hace falta saber para conseguir el archivo original de un modelo. */
export interface ModelJob {
  productId: string;
  source: ModelSourceKind;
  originalPath: string | null;
  sourceImages: string[];
}

/**
 * PUERTO: de dónde sale el modelo 3D.
 * Cada adaptador sabe conseguir un .glb "crudo" para uno o más orígenes.
 * A partir de ahí todos los modelos siguen el mismo procesamiento.
 */
export abstract class ModelSource {
  abstract readonly kinds: readonly ModelSourceKind[];
  abstract fetchOriginal(job: ModelJob): Promise<Buffer>;
}

export interface AiInputImage {
  data: Buffer;
  contentType: string;
}

/**
 * PUERTO: quién genera un modelo 3D a partir de fotos.
 * Hoy hay un adaptador para Meshy; sumar otro proveedor es escribir otra clase.
 */
export abstract class AiModelProvider {
  abstract readonly enabled: boolean;
  /** Devuelve el .glb generado. Puede tardar varios minutos. */
  abstract generateFromImages(images: AiInputImage[]): Promise<Buffer>;
}

/** Token de inyección para la lista de adaptadores de ModelSource. */
export const MODEL_SOURCE_ADAPTERS = Symbol('MODEL_SOURCE_ADAPTERS');

/** Error con un mensaje pensado para mostrarle al dueño en el panel. */
export class ModelProcessingError extends Error {}
