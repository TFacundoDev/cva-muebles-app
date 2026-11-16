import { readFile } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ModelProcessor } from './model-processor.js';
import { ModelProcessingError } from './ports.js';

const sample = () => readFile(new URL('../../../prisma/seed-assets/sillon.glb', import.meta.url));

/** Vuelve a abrir el .glb resultante y mide lo que realmente quedó guardado. */
async function measure(glb: Buffer) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  const document = await io.readBinary(new Uint8Array(glb));
  return getBounds(document.getRoot().listScenes()[0]);
}

describe('ModelProcessor', () => {
  const processor = new ModelProcessor();

  it('escala el modelo al alto real y lo apoya centrado en el piso', async () => {
    const result = await processor.process(await sample(), { widthCm: 65, depthCm: 66, heightCm: 78 });
    expect(result.sizeCm.height).toBe(78);

    const { min, max } = await measure(result.glb);
    expect(max[1] - min[1]).toBeCloseTo(0.78, 2); // glTF mide en metros
    expect(min[1]).toBeCloseTo(0, 3); // apoyado en el piso
    expect((min[0] + max[0]) / 2).toBeCloseTo(0, 3); // centrado en X
    expect((min[2] + max[2]) / 2).toBeCloseTo(0, 3); // centrado en Z
  });

  it('avisa cuando las proporciones no coinciden con las medidas cargadas', async () => {
    const result = await processor.process(await sample(), { widthCm: 200, depthCm: 200, heightCm: 78 });
    expect(result.warning).toContain('proporciones');
  });

  it('sin medidas deja el tamaño original y no avisa nada', async () => {
    const result = await processor.process(await sample(), { widthCm: null, depthCm: null, heightCm: null });
    expect(result.warning).toBeNull();
    expect(result.glb.toString('latin1', 0, 4)).toBe('glTF');
  });

  it('rechaza con un mensaje claro lo que no es un .glb', async () => {
    const notAModel = Buffer.from('esto es un archivo de texto cualquiera');
    await expect(processor.process(notAModel, { widthCm: 1, depthCm: 1, heightCm: 1 })).rejects.toThrow(
      ModelProcessingError,
    );
  });

  it('rechaza un .glb cortado', async () => {
    const truncated = (await sample()).subarray(0, 200);
    await expect(
      processor.process(truncated, { widthCm: null, depthCm: null, heightCm: null }),
    ).rejects.toThrow(/dañado|válido/);
  });
});
