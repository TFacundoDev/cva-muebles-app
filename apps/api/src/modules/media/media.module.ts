import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Module,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type ImageDto,
  type MeDto,
  type RegisterFile,
  registerFileSchema,
  type ReorderImages,
  reorderImagesSchema,
  type UploadRequest,
  uploadRequestSchema,
  type UploadTicketDto,
} from '@cva/shared';
import { Throttle } from '@nestjs/throttler';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthGuard, CurrentUser, OwnerGuard } from '../auth/auth.guard.js';
import { MediaRepository, MediaService } from './media.service.js';

@Controller('admin/products/:productId/images')
@UseGuards(AuthGuard, OwnerGuard)
export class AdminProductImagesController {
  constructor(private readonly service: MediaService) {}

  @Post('upload-url')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  uploadUrl(
    @CurrentUser() user: MeDto,
    @Body(new ZodPipe(uploadRequestSchema)) body: UploadRequest,
  ): Promise<UploadTicketDto> {
    return this.service.createImageUpload(user, body);
  }

  @Post()
  add(
    @CurrentUser() user: MeDto,
    @Param('productId') productId: string,
    @Body(new ZodPipe(registerFileSchema)) body: RegisterFile,
  ): Promise<ImageDto> {
    return this.service.addProductImage(user, productId, body.key);
  }

  @Put('order')
  reorder(
    @Param('productId') productId: string,
    @Body(new ZodPipe(reorderImagesSchema)) body: ReorderImages,
  ): Promise<ImageDto[]> {
    return this.service.reorderProductImages(productId, body.ids);
  }

  @Delete(':imageId')
  @HttpCode(204)
  remove(@Param('productId') productId: string, @Param('imageId') imageId: string): Promise<void> {
    return this.service.removeProductImage(productId, imageId);
  }
}

@Module({
  controllers: [AdminProductImagesController],
  providers: [MediaRepository, MediaService],
  exports: [MediaService],
})
export class MediaModule {}
