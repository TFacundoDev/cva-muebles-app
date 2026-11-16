import type {
  GalleryStatus,
  ModelSourceKind,
  ModelStatus,
  ProductStatus,
  Role,
} from './constants.js';

// Forma de lo que devuelve la API. La web importa estos tipos,
// así los dos lados usan exactamente los mismos nombres de campos.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface ImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

// Lo que ve el público de un modelo 3D listo.
export interface ModelPublicDto {
  glbUrl: string;
  posterUrl: string | null;
  sizeBytes: number | null;
}

// Lo que ve el panel: incluye el estado del procesamiento.
export interface ModelAdminDto {
  source: ModelSourceKind;
  status: ModelStatus;
  glbUrl: string | null;
  posterUrl: string | null;
  sizeBytes: number | null;
  error: string | null;
  warning: string | null;
  updatedAt: string;
}

export interface ProductSummaryDto {
  id: string;
  name: string;
  slug: string;
  category: CategoryRef;
  price: number | null;
  coverUrl: string | null;
  has3d: boolean;
  woods: string[];
  featured: boolean;
  status: ProductStatus;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
  materials: string;
  images: ImageDto[];
  model: ModelPublicDto | null;
}

export interface ProductAdminDto extends ProductDetailDto {
  modelAdmin: ModelAdminDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAdminSummaryDto extends ProductSummaryDto {
  modelStatus: ModelStatus | null;
  updatedAt: string;
}

export interface ProductFacetsDto {
  woods: string[];
}

export interface GalleryProductRef {
  id: string;
  name: string;
  slug: string;
  categorySlug: string;
}

export interface GalleryPostDto {
  id: string;
  imageUrl: string;
  caption: string;
  authorName: string;
  product: GalleryProductRef | null;
  createdAt: string;
}

export interface GalleryAdminDto extends GalleryPostDto {
  status: GalleryStatus;
  authorEmail: string;
  moderatedAt: string | null;
}

export interface GalleryMineDto extends GalleryPostDto {
  status: GalleryStatus;
}

export type GalleryCountsDto = Record<GalleryStatus, number>;

export interface UploadTicketDto {
  key: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface MeDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface UserAdminDto extends MeDto {
  createdAt: string;
  galleryPosts: number;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  details?: string[];
}
