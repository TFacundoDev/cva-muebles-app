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
  type AdminGalleryQuery,
  adminGalleryQuerySchema,
  type GalleryAdminDto,
  type GalleryCountsDto,
  type GalleryCreate,
  galleryCreateSchema,
  type GalleryMineDto,
  type GalleryModerate,
  galleryModerateSchema,
  type GalleryPostDto,
  type GalleryQuery,
  galleryQuerySchema,
  type MeDto,
  type Paginated,
  type UploadRequest,
  uploadRequestSchema,
  type UploadTicketDto,
  type UserAdminDto,
} from '@cva/shared';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthGuard, CurrentUser, OwnerGuard } from '../auth/auth.guard.js';
import { MediaModule } from '../media/media.module.js';
import { ProductsModule } from '../products/products.module.js';
import { GalleryRepository, GalleryService } from './gallery.service.js';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly service: GalleryService) {}

  /** Público: solo fotos aprobadas. */
  @Get()
  @SkipThrottle()
  list(@Query(new ZodPipe(galleryQuerySchema)) query: GalleryQuery): Promise<Paginated<GalleryPostDto>> {
    return this.service.listApproved(query);
  }

  @Get('mine')
  @UseGuards(AuthGuard)
  mine(@CurrentUser() user: MeDto): Promise<GalleryMineDto[]> {
    return this.service.listMine(user);
  }

  // Las subidas tienen un límite más bajo que el resto de la API.
  @Post('upload-url')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  uploadUrl(
    @CurrentUser() user: MeDto,
    @Body(new ZodPipe(uploadRequestSchema)) body: UploadRequest,
  ): Promise<UploadTicketDto> {
    return this.service.createUpload(user, body);
  }

  @Post()
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: MeDto,
    @Body(new ZodPipe(galleryCreateSchema)) body: GalleryCreate,
  ): Promise<GalleryMineDto> {
    return this.service.create(user, body);
  }
}

@Controller('admin/gallery')
@UseGuards(AuthGuard, OwnerGuard)
export class AdminGalleryController {
  constructor(private readonly service: GalleryService) {}

  @Get()
  list(
    @Query(new ZodPipe(adminGalleryQuerySchema)) query: AdminGalleryQuery,
  ): Promise<Paginated<GalleryAdminDto>> {
    return this.service.adminList(query);
  }

  @Get('counts')
  counts(): Promise<GalleryCountsDto> {
    return this.service.counts();
  }

  @Patch(':id')
  @HttpCode(204)
  moderate(
    @Param('id') id: string,
    @Body(new ZodPipe(galleryModerateSchema)) body: GalleryModerate,
  ): Promise<void> {
    return this.service.moderate(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}

/** Usuarios del panel (solo lectura por ahora). */
@Controller('admin/users')
@UseGuards(AuthGuard, OwnerGuard)
export class AdminUsersController {
  constructor(private readonly service: GalleryService) {}

  @Get()
  list(): Promise<UserAdminDto[]> {
    return this.service.usersWithCounts();
  }
}

@Module({
  imports: [MediaModule, ProductsModule],
  controllers: [GalleryController, AdminGalleryController, AdminUsersController],
  providers: [GalleryRepository, GalleryService],
})
export class GalleryModule {}
