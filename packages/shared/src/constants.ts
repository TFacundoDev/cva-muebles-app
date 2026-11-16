// Valores fijos que comparten la web y la API.

export const PRODUCT_STATUSES = ['draft', 'published', 'hidden'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const MODEL_STATUSES = ['pending', 'processing', 'ready', 'error'] as const;
export type ModelStatus = (typeof MODEL_STATUSES)[number];

// De dónde sale el modelo 3D de un producto.
export const MODEL_SOURCES = ['upload', 'scan', 'ai', 'custom'] as const;
export type ModelSourceKind = (typeof MODEL_SOURCES)[number];

export const GALLERY_STATUSES = ['pending', 'approved', 'rejected', 'hidden'] as const;
export type GalleryStatus = (typeof GALLERY_STATUSES)[number];

export const ROLES = ['customer', 'owner'] as const;
export type Role = (typeof ROLES)[number];

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MODEL_CONTENT_TYPES = ['model/gltf-binary', 'application/octet-stream'] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB por foto
export const MAX_MODEL_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB para el archivo original
export const TARGET_MODEL_BYTES = 8 * 1024 * 1024; // objetivo del .glb ya optimizado

export const MAX_PENDING_GALLERY_POSTS = 5; // fotos en espera por cliente
export const MAX_AI_IMAGES = 4;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  hidden: 'Oculto',
};

export const MODEL_STATUS_LABELS: Record<ModelStatus, string> = {
  pending: 'En cola',
  processing: 'Procesando',
  ready: 'Listo',
  error: 'Error',
};

export const MODEL_SOURCE_LABELS: Record<ModelSourceKind, string> = {
  upload: 'Archivo .glb',
  scan: 'Escaneo con el celular',
  ai: 'IA desde fotos',
  custom: 'Modelado a medida',
};

export const GALLERY_STATUS_LABELS: Record<GalleryStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  hidden: 'Oculta',
};

// Etiquetas de caché que la API le pide a la web que regenere.
export const CACHE_TAGS = {
  products: 'products',
  categories: 'categories',
  gallery: 'gallery',
  settings: 'settings',
} as const;
export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
