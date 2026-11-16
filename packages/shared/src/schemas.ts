import { z } from 'zod';
import {
  GALLERY_STATUSES,
  MAX_AI_IMAGES,
  MODEL_SOURCES,
  PRODUCT_STATUSES,
} from './constants.js';

// Esquemas de validación. La API los usa para validar lo que entra
// y la web para validar los formularios antes de enviarlos.

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones');

const optionalCm = z.number().int().min(1).max(1000).nullable();

// En la URL todo llega como texto: "true"/"1" es verdadero.
const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1')
  .optional();

const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(60).default(24);

// ---------- Categorías ----------
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, 'Poné un nombre').max(60),
  slug: slug.optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categoryUpdateSchema = categoryInputSchema.partial();
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

// ---------- Productos ----------
export const productInputSchema = z.object({
  categoryId: z.string().min(1, 'Elegí una categoría'),
  name: z.string().trim().min(1, 'Poné un nombre').max(120),
  slug: slug.optional(),
  description: z.string().trim().max(4000).default(''),
  price: z.number().min(0).max(999_999_999).nullable().default(null),
  widthCm: optionalCm.default(null),
  depthCm: optionalCm.default(null),
  heightCm: optionalCm.default(null),
  woods: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  materials: z.string().trim().max(300).default(''),
  status: z.enum(PRODUCT_STATUSES).default('draft'),
  featured: z.boolean().default(false),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const productUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  slug: slug.optional(),
  description: z.string().trim().max(4000).optional(),
  price: z.number().min(0).max(999_999_999).nullable().optional(),
  widthCm: optionalCm.optional(),
  depthCm: optionalCm.optional(),
  heightCm: optionalCm.optional(),
  woods: z.array(z.string().trim().min(1).max(40)).max(6).optional(),
  materials: z.string().trim().max(300).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  featured: z.boolean().optional(),
});
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export const productQuerySchema = z.object({
  category: z.string().trim().max(80).optional(),
  wood: z.string().trim().max(40).optional(),
  q: z.string().trim().max(80).optional(),
  featured: queryBool,
  with3d: queryBool,
  page,
  pageSize,
});
export type ProductQuery = z.infer<typeof productQuerySchema>;

export const adminProductQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
  page,
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;

// ---------- Subidas ----------
export const uploadRequestSchema = z.object({
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().min(1),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;

export const modelUploadRequestSchema = uploadRequestSchema.extend({
  // "model" para el .glb; "image" para las fotos que usa la IA.
  kind: z.enum(['model', 'image']).default('model'),
});
export type ModelUploadRequest = z.infer<typeof modelUploadRequestSchema>;

const storageKey = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[a-zA-Z0-9/_.-]+$/, 'Clave de archivo inválida')
  .refine((k) => !k.includes('..'), 'Clave de archivo inválida');

export const registerFileSchema = z.object({ key: storageKey });
export type RegisterFile = z.infer<typeof registerFileSchema>;

export const reorderImagesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(40),
});
export type ReorderImages = z.infer<typeof reorderImagesSchema>;

// ---------- Modelos 3D ----------
export const registerModelSchema = z
  .object({
    source: z.enum(MODEL_SOURCES),
    key: storageKey.optional(),
    imageKeys: z.array(storageKey).min(1).max(MAX_AI_IMAGES).optional(),
  })
  .refine((v) => (v.source === 'ai' ? !!v.imageKeys?.length : !!v.key), {
    message: 'Falta el archivo del modelo o las fotos para generarlo',
  });
export type RegisterModel = z.infer<typeof registerModelSchema>;

// ---------- Galería ----------
export const galleryCreateSchema = z.object({
  key: storageKey,
  productId: z.string().min(1, 'Elegí el mueble'),
  caption: z.string().trim().max(200).default(''),
  consent: z.literal(true, 'Tenés que aceptar que se publique la foto'),
});
export type GalleryCreate = z.infer<typeof galleryCreateSchema>;

export const galleryQuerySchema = z.object({
  productId: z.string().optional(),
  category: z.string().trim().max(80).optional(),
  page,
  pageSize,
});
export type GalleryQuery = z.infer<typeof galleryQuerySchema>;

export const adminGalleryQuerySchema = z.object({
  status: z.enum(GALLERY_STATUSES).default('pending'),
  page,
  pageSize,
});
export type AdminGalleryQuery = z.infer<typeof adminGalleryQuerySchema>;

export const galleryModerateSchema = z.object({
  status: z.enum(['approved', 'rejected', 'hidden']),
});
export type GalleryModerate = z.infer<typeof galleryModerateSchema>;

// ---------- Datos del local ----------
const text = (max: number) => z.string().trim().max(max);

export const settingsSchema = z.object({
  storeName: text(60),
  tagline: text(80),
  whatsappNumber: z
    .string()
    .trim()
    .regex(/^\d{0,15}$/, 'Solo números, con código de país y sin signos. Ej: 5493794123456'),
  whatsappMessage: text(300),
  address: text(160),
  city: text(80),
  hours: text(160),
  mapEmbedUrl: z.union([z.literal(''), z.url().max(1000)]),
  mapLink: z.union([z.literal(''), z.url().max(1000)]),
  aboutTitle: text(100),
  aboutText: text(1500),
});
export type StoreSettings = z.infer<typeof settingsSchema>;

export const settingsUpdateSchema = settingsSchema.partial();
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'CVA Muebles',
  tagline: 'Carpintería · Corrientes',
  whatsappNumber: '',
  whatsappMessage: 'Hola, me interesa {producto} ({link}). ¿Está disponible?',
  address: '',
  city: 'Corrientes Capital',
  hours: '',
  mapEmbedUrl: '',
  mapLink: '',
  aboutTitle: 'Madera trabajada con tiempo',
  aboutText: '',
};
