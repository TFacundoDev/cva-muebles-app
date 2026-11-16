import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AdminProductQuery,
  adminProductQuerySchema,
  type MeDto,
  type ModelAdminDto,
  type ModelUploadRequest,
  modelUploadRequestSchema,
  type Paginated,
  type ProductAdminDto,
  type ProductAdminSummaryDto,
  type ProductDetailDto,
  type ProductFacetsDto,
  type ProductInput,
  productInputSchema,
  type ProductQuery,
  productQuerySchema,
  type ProductSummaryDto,
  type ProductUpdate,
  productUpdateSchema,
  type RegisterFile,
  registerFileSchema,
  type RegisterModel,
  registerModelSchema,
  type UploadTicketDto,
} from '@cva/shared';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthGuard, CurrentUser, OwnerGuard } from '../auth/auth.guard.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { MediaModule } from '../media/media.module.js';
import { MediaService } from '../media/media.service.js';
import { Models3dModule } from '../models3d/models3d.module.js';
import { Models3dService } from '../models3d/models3d.service.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsService } from './products.service.js';

/**
 * Zona pública: lee el catálogo sin login.
 * Sin límite de pedidos: casi todas estas lecturas las hace el servidor de la
 * web (que las cachea) y llegan todas desde la misma IP.
 */
@SkipThrottle()
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  list(@Query(new ZodPipe(productQuerySchema)) query: ProductQuery): Promise<Paginated<ProductSummaryDto>> {
    return this.service.list(query);
  }

  @Get('facets')
  facets(): Promise<ProductFacetsDto> {
    return this.service.facets();
  }

  @Get(':slug')
  detail(@Param('slug') slug: string): Promise<ProductDetailDto> {
    return this.service.detailBySlug(slug);
  }
}

/** Zona del dueño: exige token y rol de dueño. */
@Controller('admin/products')
@UseGuards(AuthGuard, OwnerGuard)
export class AdminProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  list(
    @Query(new ZodPipe(adminProductQuerySchema)) query: AdminProductQuery,
  ): Promise<Paginated<ProductAdminSummaryDto>> {
    return this.service.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ProductAdminDto> {
    return this.service.adminGet(id);
  }

  @Post()
  create(@Body(new ZodPipe(productInputSchema)) body: ProductInput): Promise<ProductAdminDto> {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(productUpdateSchema)) body: ProductUpdate,
  ): Promise<ProductAdminDto> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}

/**
 * Modelo 3D de un producto. Vive acá y no en models3d porque necesita las
 * medidas del producto para escalar el modelo a tamaño real.
 */
@Controller('admin')
@UseGuards(AuthGuard, OwnerGuard)
export class ProductModelsController {
  constructor(
    private readonly products: ProductsService,
    private readonly models: Models3dService,
    private readonly media: MediaService,
  ) {}

  @Get('model-capabilities')
  capabilities(): { ai: boolean } {
    return { ai: this.models.aiEnabled };
  }

  @Post('products/:id/model/upload-url')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  uploadUrl(
    @CurrentUser() user: MeDto,
    @Body(new ZodPipe(modelUploadRequestSchema)) body: ModelUploadRequest,
  ): Promise<UploadTicketDto> {
    // "image" se usa para las fotos de la IA y para la captura de portada.
    return body.kind === 'image'
      ? this.media.createImageUpload(user, body)
      : this.models.createModelUpload(user, body);
  }

  @Post('products/:id/model')
  async start(
    @CurrentUser() user: MeDto,
    @Param('id') id: string,
    @Body(new ZodPipe(registerModelSchema)) body: RegisterModel,
  ): Promise<ModelAdminDto> {
    const dimensions = await this.products.dimensions(id);
    return this.models.start(user, id, dimensions, body);
  }

  @Get('products/:id/model')
  status(@Param('id') id: string): Promise<ModelAdminDto> {
    return this.models.getAdminOrFail(id);
  }

  @Post('products/:id/model/poster')
  poster(
    @CurrentUser() user: MeDto,
    @Param('id') id: string,
    @Body(new ZodPipe(registerFileSchema)) body: RegisterFile,
  ): Promise<ModelAdminDto> {
    return this.models.setPoster(user, id, body.key);
  }

  @Delete('products/:id/model')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.models.removeForProduct(id);
  }
}

@Module({
  imports: [CategoriesModule, MediaModule, Models3dModule],
  controllers: [ProductsController, AdminProductsController, ProductModelsController],
  providers: [ProductsRepository, ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
