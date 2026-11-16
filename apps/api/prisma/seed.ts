// Datos de ejemplo para ver la tienda llena desde el primer día.
// Uso: pnpm db:seed            (no hace nada si ya hay categorías)
//      pnpm db:seed -- --force (borra todo y vuelve a cargar)
//
// Antes de salir a producción: borrá estos productos y las fotos de la
// galería desde el panel, o no corras este script contra la base real.
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { slugify } from '@cva/shared';
import sharp from 'sharp';
import { loadEnv } from '../src/config/app-config.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { FileStorage } from '../src/infrastructure/storage/file-storage.port.js';
import { LocalStorage } from '../src/infrastructure/storage/local.storage.js';
import { R2Storage } from '../src/infrastructure/storage/r2.storage.js';
import { ModelProcessor } from '../src/modules/models3d/model-processor.js';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), 'seed-assets');

interface SeedProduct {
  name: string;
  category: string;
  asset: string;
  model?: string;
  wood: string;
  size: [width: number, depth: number, height: number];
  featured?: boolean;
  description: string;
  materials: string;
}

const CATEGORIES = ['Living', 'Comedor', 'Dormitorio', 'Guardado'];

const PRODUCTS: SeedProduct[] = [
  {
    name: 'Sillón Algarrobo',
    category: 'Living',
    asset: 'sillon.png',
    model: 'sillon.glb',
    wood: 'Algarrobo',
    size: [65, 66, 78],
    featured: true,
    description:
      'Sillón de líneas rectas con apoyabrazos inclinados y respaldo tapizado. Madera maciza trabajada a mano.',
    materials: 'Algarrobo macizo, tapizado en símil cuero, laca mate al agua',
  },
  {
    name: 'Mesa ratona Lapacho',
    category: 'Living',
    asset: 'mesa-ratona.png',
    model: 'mesa-ratona.glb',
    wood: 'Lapacho',
    size: [100, 55, 42],
    featured: true,
    description: 'Mesa baja de tapa gruesa y patas rectas, pensada para el centro del living.',
    materials: 'Lapacho macizo, terminación al aceite',
  },
  {
    name: 'Rack de TV Timbó',
    category: 'Living',
    asset: 'rack-tv.png',
    wood: 'Timbó',
    size: [150, 40, 55],
    description: 'Rack bajo con dos puertas y estante abierto para equipos.',
    materials: 'Timbó, herrajes de cierre suave',
  },
  {
    name: 'Mesa de comedor Quebracho',
    category: 'Comedor',
    asset: 'mesa-comedor.png',
    wood: 'Quebracho',
    size: [160, 90, 76],
    featured: true,
    description: 'Mesa para seis personas con tapa de tablones enteros.',
    materials: 'Quebracho colorado macizo, laca mate',
  },
  {
    name: 'Silla Guayubira',
    category: 'Comedor',
    asset: 'silla.png',
    wood: 'Guayubira',
    size: [45, 48, 90],
    description: 'Silla de respaldo alto y asiento de madera, liviana y firme.',
    materials: 'Guayubira maciza',
  },
  {
    name: 'Cama 2 plazas Cedro',
    category: 'Dormitorio',
    asset: 'cama.png',
    wood: 'Cedro',
    size: [150, 200, 95],
    featured: true,
    description: 'Cama de dos plazas con respaldo de tablas verticales. Para colchón de 140 × 190 cm.',
    materials: 'Cedro macizo, parrilla de pino',
  },
  {
    name: 'Mesa de luz Cedro',
    category: 'Dormitorio',
    asset: 'mesa-de-luz.png',
    wood: 'Cedro',
    size: [45, 38, 55],
    description: 'Mesa de luz con un cajón y estante inferior.',
    materials: 'Cedro macizo, correderas metálicas',
  },
  {
    name: 'Cómoda Petiribí',
    category: 'Dormitorio',
    asset: 'comoda.png',
    wood: 'Petiribí',
    size: [110, 45, 85],
    description: 'Cómoda de cuatro cajones amplios con tiradores de madera.',
    materials: 'Petiribí, correderas telescópicas',
  },
  {
    name: 'Biblioteca Paraíso',
    category: 'Guardado',
    asset: 'biblioteca.png',
    wood: 'Paraíso',
    size: [90, 30, 180],
    description: 'Biblioteca de cinco estantes, abierta, para libros y objetos.',
    materials: 'Paraíso macizo, terminación natural',
  },
  {
    name: 'Ropero Lapacho',
    category: 'Guardado',
    asset: 'ropero.png',
    wood: 'Lapacho',
    size: [120, 55, 190],
    description: 'Ropero de dos puertas con barral, estante superior y cajón.',
    materials: 'Lapacho, interior de melamina',
  },
];

// Fotos de la galería de ejemplo: [mueble, nombre, comentario].
const GALLERY: [string, string, string][] = [
  ['Sillón Algarrobo', 'María', 'Quedó perfecto al lado de la ventana.'],
  ['Mesa de comedor Quebracho', 'Lucas', 'Entramos los seis cómodos.'],
  ['Cama 2 plazas Cedro', 'Ana', ''],
  ['Biblioteca Paraíso', 'Sofía', 'Justo lo que buscaba para el estudio.'],
];

async function main(): Promise<void> {
  const env = loadEnv();
  const force = process.argv.includes('--force');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: env.DATABASE_URL,
      ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    }),
  });
  const storage: FileStorage =
    env.STORAGE_DRIVER === 'r2'
      ? new R2Storage({
          accountId: env.R2_ACCOUNT_ID,
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
          bucket: env.R2_BUCKET,
          publicUrl: env.R2_PUBLIC_URL,
        })
      : new LocalStorage({
          dir: env.STORAGE_LOCAL_DIR,
          publicApiUrl: env.PUBLIC_API_URL,
          signingSecret: env.UPLOAD_SIGNING_SECRET,
        });

  try {
    if ((await prisma.category.count()) > 0) {
      if (!force) {
        console.log('La base ya tiene datos. Usá "pnpm db:seed -- --force" para volver a cargar.');
        return;
      }
      console.log('Borrando datos anteriores…');
      await prisma.galleryPost.deleteMany();
      await prisma.product.deleteMany(); // fotos y modelos se van en cascada
      await prisma.category.deleteMany();
      await prisma.profile.deleteMany({ where: { email: { endsWith: '@ejemplo.cva' } } });
    }

    const toWebp = async (file: string): Promise<Buffer> =>
      sharp(await readFile(join(ASSETS, file)))
        .webp({ quality: 88 })
        .toBuffer();

    const categoryIds = new Map<string, string>();
    for (const [index, name] of CATEGORIES.entries()) {
      const row = await prisma.category.create({ data: { name, slug: slugify(name), sortOrder: index } });
      categoryIds.set(name, row.id);
    }

    const processor = new ModelProcessor();
    const productIds = new Map<string, string>();
    for (const item of PRODUCTS) {
      const [widthCm, depthCm, heightCm] = item.size;
      const product = await prisma.product.create({
        data: {
          categoryId: categoryIds.get(item.category)!,
          name: item.name,
          slug: slugify(item.name),
          description: item.description,
          materials: item.materials,
          woods: [item.wood],
          widthCm,
          depthCm,
          heightCm,
          status: 'published',
          featured: item.featured ?? false,
        },
      });
      productIds.set(item.name, product.id);

      const imagePath = `products/${product.id}/${randomUUID()}.webp`;
      await storage.write(imagePath, await toWebp(item.asset), 'image/webp');
      await prisma.productImage.create({ data: { productId: product.id, path: imagePath, sortOrder: 0 } });

      if (item.model) {
        // El modelo de ejemplo pasa por el mismo procesamiento que uno subido desde el panel.
        const result = await processor.process(await readFile(join(ASSETS, item.model)), {
          widthCm,
          depthCm,
          heightCm,
        });
        const glbPath = `models/${product.id}/${randomUUID()}.glb`;
        await storage.write(glbPath, result.glb, 'model/gltf-binary');
        await prisma.model3d.create({
          data: {
            productId: product.id,
            source: 'custom',
            status: 'ready',
            glbPath,
            sizeBytes: result.glb.length,
            warning: result.warning,
            targetWidth: widthCm,
            targetDepth: depthCm,
            targetHeight: heightCm,
          },
        });
      }
      console.log(`  ✓ ${item.name}${item.model ? ' (con modelo 3D)' : ''}`);
    }

    for (const [index, [productName, author, caption]] of GALLERY.entries()) {
      const userId = `ejemplo-${index + 1}`;
      await prisma.profile.upsert({
        where: { userId },
        create: { userId, email: `cliente${index + 1}@ejemplo.cva`, displayName: author },
        update: {},
      });
      const asset = PRODUCTS.find((p) => p.name === productName)!.asset;
      const imagePath = `gallery/${randomUUID()}.webp`;
      await storage.write(imagePath, await toWebp(asset), 'image/webp');
      await prisma.galleryPost.create({
        data: {
          userId,
          productId: productIds.get(productName)!,
          imagePath,
          caption,
          status: 'approved',
          moderatedAt: new Date(),
        },
      });
    }

    console.log(
      `Listo: ${CATEGORIES.length} categorías, ${PRODUCTS.length} productos y ${GALLERY.length} fotos de galería de ejemplo.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
