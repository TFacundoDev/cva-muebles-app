import { type Document, Logger, NodeIO, type Scene } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, getBounds, prune, textureCompress, weld } from '@gltf-transform/functions';
import { Injectable } from '@nestjs/common';
import { formatBytes, TARGET_MODEL_BYTES } from '@cva/shared';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { ModelProcessingError } from './ports.js';

export interface TargetDimensions {
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
}

export interface ProcessedModel {
  glb: Buffer;
  /** Aviso para el dueño (no impide publicar). */
  warning: string | null;
  /** Tamaño final del modelo, en centímetros. */
  sizeCm: { width: number; depth: number; height: number };
}

/** Cuánto pueden diferir las proporciones del modelo y las medidas cargadas. */
const PROPORTION_TOLERANCE = 0.15;

/**
 * Convierte cualquier .glb en uno liviano, centrado y a escala real.
 * No sabe nada de HTTP, de la base ni de dónde vino el archivo: recibe bytes
 * y devuelve bytes, por eso se puede probar sola.
 */
@Injectable()
export class ModelProcessor {
  private io: Promise<NodeIO> | null = null;

  private getIo(): Promise<NodeIO> {
    this.io ??= (async () =>
      new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'draco3d.decoder': await draco3d.createDecoderModule(),
        'draco3d.encoder': await draco3d.createEncoderModule(),
        'meshopt.decoder': MeshoptDecoder,
      }))();
    return this.io;
  }

  async process(input: Buffer, target: TargetDimensions): Promise<ProcessedModel> {
    // 1. Validar: los .glb empiezan con los bytes "glTF".
    if (input.length < 20 || input.toString('latin1', 0, 4) !== 'glTF') {
      throw new ModelProcessingError(
        'El archivo no es un .glb válido. Exportá el modelo en formato GLB (glTF binario).',
      );
    }
    const io = await this.getIo();
    let document: Document;
    try {
      document = await io.readBinary(new Uint8Array(input));
    } catch {
      throw new ModelProcessingError('No se pudo leer el modelo: el archivo .glb está dañado o incompleto.');
    }
    document.setLogger(new Logger(Logger.Verbosity.WARN));
    const root = document.getRoot();
    const scene = root.getDefaultScene() ?? root.listScenes()[0];
    if (!scene || root.listMeshes().length === 0) {
      throw new ModelProcessingError('El archivo no contiene ningún objeto 3D.');
    }

    // 2. Normalizar: apoyado en el piso, centrado y del tamaño real.
    const { warning: proportionWarning, sizeCm } = this.normalize(document, scene, target);

    // 3. Optimizar: sacar lo repetido, achicar texturas y comprimir la geometría.
    await document.transform(
      dedup(),
      prune(),
      weld(),
      textureCompress({ encoder: sharp, resize: [2048, 2048] }),
      draco(),
    );
    let glb = Buffer.from(await io.writeBinary(document));
    if (glb.length > TARGET_MODEL_BYTES) {
      // Segundo intento con texturas más chicas.
      await document.transform(textureCompress({ encoder: sharp, resize: [1024, 1024] }));
      glb = Buffer.from(await io.writeBinary(document));
    }

    const warnings = [proportionWarning];
    if (glb.length > TARGET_MODEL_BYTES) {
      warnings.push(
        `El modelo pesa ${formatBytes(glb.length)} después de comprimirlo; puede tardar en cargar con datos móviles.`,
      );
    }
    return { glb, warning: warnings.filter(Boolean).join(' ') || null, sizeCm };
  }

  /**
   * Envuelve todo el contenido en un nodo que lo mueve y lo escala.
   * glTF mide en metros y usa el eje Y hacia arriba.
   */
  private normalize(
    document: Document,
    scene: Scene,
    target: TargetDimensions,
  ): { warning: string | null; sizeCm: ProcessedModel['sizeCm'] } {
    const { min, max } = getBounds(scene);
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    if (!size.every((value) => Number.isFinite(value)) || size[1] <= 0) {
      throw new ModelProcessingError('No se pudo medir el modelo: no tiene geometría visible.');
    }

    // La escala sale del alto, que es la medida menos ambigua (el modelo
    // puede venir girado y confundir ancho con profundidad).
    let scale = 1;
    if (target.heightCm) {
      scale = target.heightCm / 100 / size[1];
    } else if (target.widthCm || target.depthCm) {
      const biggestTarget = Math.max(target.widthCm ?? 0, target.depthCm ?? 0) / 100;
      scale = biggestTarget / Math.max(size[0], size[2]);
    }

    const centerX = (min[0] + max[0]) / 2;
    const centerZ = (min[2] + max[2]) / 2;
    const wrapper = document
      .createNode('normalizado')
      .setScale([scale, scale, scale])
      .setTranslation([-centerX * scale, -min[1] * scale, -centerZ * scale]);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      wrapper.addChild(child);
    }
    scene.addChild(wrapper);

    const sizeCm = {
      width: Math.round(size[0] * scale * 100),
      height: Math.round(size[1] * scale * 100),
      depth: Math.round(size[2] * scale * 100),
    };

    let warning: string | null = null;
    if (target.heightCm && target.widthCm && target.depthCm) {
      // Se comparan ordenadas, así no importa si el modelo vino girado 90°.
      const model = [sizeCm.width, sizeCm.depth].sort((a, b) => a - b);
      const expected = [target.widthCm, target.depthCm].sort((a, b) => a - b);
      const differs = model.some(
        (value, index) => Math.abs(value - expected[index]) / expected[index] > PROPORTION_TOLERANCE,
      );
      if (differs) {
        warning =
          `Las proporciones del modelo no coinciden con las medidas cargadas: con ${target.heightCm} cm de alto, ` +
          `el modelo mide ${sizeCm.width} × ${sizeCm.depth} cm de base y el producto dice ` +
          `${target.widthCm} × ${target.depthCm} cm. Revisá las medidas o el modelo.`;
      }
    }
    return { warning, sizeCm };
  }
}
