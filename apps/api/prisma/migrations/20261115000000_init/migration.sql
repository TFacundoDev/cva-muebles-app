-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('draft', 'published', 'hidden');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('pending', 'processing', 'ready', 'error');

-- CreateEnum
CREATE TYPE "ModelSource" AS ENUM ('upload', 'scan', 'ai', 'custom');

-- CreateEnum
CREATE TYPE "GalleryStatus" AS ENUM ('pending', 'approved', 'rejected', 'hidden');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('customer', 'owner');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "price" DECIMAL(12,2),
    "width_cm" INTEGER,
    "depth_cm" INTEGER,
    "height_cm" INTEGER,
    "woods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "materials" TEXT NOT NULL DEFAULT '',
    "status" "ProductStatus" NOT NULL DEFAULT 'draft',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models_3d" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source" "ModelSource" NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'pending',
    "original_path" TEXT,
    "source_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "glb_path" TEXT,
    "poster_path" TEXT,
    "size_bytes" INTEGER,
    "target_width_cm" INTEGER,
    "target_depth_cm" INTEGER,
    "target_height_cm" INTEGER,
    "error" TEXT,
    "warning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_3d_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'customer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "gallery_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT,
    "image_path" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "status" "GalleryStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moderated_at" TIMESTAMP(3),

    CONSTRAINT "gallery_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "product_images_product_id_idx" ON "product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "models_3d_product_id_key" ON "models_3d"("product_id");

-- CreateIndex
CREATE INDEX "gallery_posts_status_created_at_idx" ON "gallery_posts"("status", "created_at");

-- CreateIndex
CREATE INDEX "gallery_posts_product_id_idx" ON "gallery_posts"("product_id");

-- CreateIndex
CREATE INDEX "gallery_posts_user_id_idx" ON "gallery_posts"("user_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models_3d" ADD CONSTRAINT "models_3d_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_posts" ADD CONSTRAINT "gallery_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_posts" ADD CONSTRAINT "gallery_posts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
