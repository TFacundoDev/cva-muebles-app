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
  UseGuards,
} from '@nestjs/common';
import {
  type CategoryDto,
  type CategoryInput,
  categoryInputSchema,
  type CategoryUpdate,
  categoryUpdateSchema,
} from '@cva/shared';
import { SkipThrottle } from '@nestjs/throttler';
import { ZodPipe } from '../../common/zod.pipe.js';
import { AuthGuard, OwnerGuard } from '../auth/auth.guard.js';
import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './categories.service.js';

@SkipThrottle()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  list(): Promise<CategoryDto[]> {
    return this.service.list();
  }
}

@Controller('admin/categories')
@UseGuards(AuthGuard, OwnerGuard)
export class AdminCategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Post()
  create(@Body(new ZodPipe(categoryInputSchema)) body: CategoryInput): Promise<CategoryDto> {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(categoryUpdateSchema)) body: CategoryUpdate,
  ): Promise<CategoryDto> {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string): Promise<void> {
    return this.service.delete(id);
  }
}

@Module({
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesRepository, CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
