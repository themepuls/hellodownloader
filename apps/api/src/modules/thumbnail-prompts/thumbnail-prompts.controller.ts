import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { ThumbnailPromptsService } from './thumbnail-prompts.service';
import {
  CreateThumbnailPromptDto,
  PreviewThumbnailPromptDto,
  UpdateThumbnailPromptDto,
} from './thumbnail-prompts.dto';
import { THUMBNAIL_PROMPT_TYPES, type ThumbnailPromptType } from '@hellodownloader/shared-types';

@Controller('admin/thumbnail-prompts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ThumbnailPromptsController {
  constructor(private prompts: ThumbnailPromptsService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    const normalizedType = THUMBNAIL_PROMPT_TYPES.includes(type as ThumbnailPromptType)
      ? (type as ThumbnailPromptType)
      : undefined;
    return this.prompts.findAll({ type: normalizedType, search });
  }

  @Post('preview/combined')
  preview(@Body() dto: PreviewThumbnailPromptDto) {
    return this.prompts.buildPreview(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prompts.findById(id);
  }

  @Post()
  create(@Body() dto: CreateThumbnailPromptDto) {
    return this.prompts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateThumbnailPromptDto) {
    return this.prompts.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prompts.delete(id);
  }
}
