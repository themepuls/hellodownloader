import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync } from 'fs';
import { ThumbnailService, type ThumbnailMode } from './thumbnail.service';
import { ThumbnailHeadlineService } from './thumbnail-headline.service';
import { IsEnum, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { effectivePlan, hasProAccess, PlanType, ThumbnailRatio } from '@hellodownloader/shared-types';
import { Public } from '../auth/public.decorator';
import { deliverLocalFile } from '../../utils/file-delivery';

class OriginalThumbnailDto {
  @IsUrl()
  url!: string;
}

class CreateThumbnailDto {
  @IsUrl()
  videoUrl!: string;

  @IsEnum(ThumbnailRatio)
  ratio!: ThumbnailRatio;

  @IsIn(['adjust', 'generate'])
  mode!: ThumbnailMode;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  additionalInstructions?: string;
}

class HeadlineDto {
  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  textStyle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ratio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;
}

@Controller('thumbnails')
export class ThumbnailController {
  constructor(
    private thumbnailService: ThumbnailService,
    private headlineService: ThumbnailHeadlineService,
  ) {}

  @Public()
  @Post('original')
  getOriginal(@Body() dto: OriginalThumbnailDto) {
    return this.thumbnailService.getOriginalThumbnail(dto.url);
  }

  @Post('ai')
  createAi(
    @Req() req: { user: { id: string; plan: string; role: string } },
    @Body() dto: CreateThumbnailDto,
  ) {
    const plan = effectivePlan(req.user.plan, req.user.role) as PlanType;
    return this.thumbnailService.createAi(
      req.user.id,
      plan,
      dto.videoUrl,
      dto.ratio,
      dto.mode,
      dto.prompt,
      dto.categorySlug,
      dto.additionalInstructions,
    );
  }

  @Post('headline')
  generateHeadline(
    @Req() req: { user: { id: string; plan: string; role: string } },
    @Body() dto: HeadlineDto,
  ) {
    if (!hasProAccess(req.user.plan, req.user.role)) {
      throw new BadRequestException('Pro plan required for AI headline generation');
    }
    return this.headlineService.generateHeadline({
      title: dto.title,
      category: dto.category,
      categorySlug: dto.categorySlug,
      textStyle: dto.textStyle,
      ratio: dto.ratio,
      instructions: dto.instructions,
      thumbnailUrl: dto.thumbnailUrl,
    });
  }

  @Post('original/save')
  recordOriginal(
    @Req() req: { user: { id: string } },
    @Body() dto: OriginalThumbnailDto,
  ) {
    return this.thumbnailService.recordOriginalDownload(req.user.id, dto.url);
  }

  @Public()
  @Get('features')
  getFeatures() {
    return this.thumbnailService.getAiFeatures();
  }

  @Get()
  findAll(@Req() req: { user: { id: string } }) {
    return this.thumbnailService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.thumbnailService.findById(req.user.id, id);
  }

  @Public()
  @Get(':id/file')
  async downloadFile(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.thumbnailService.getExportFile(id);
    if (!existsSync(record.exportPath)) {
      throw new NotFoundException('File no longer on server');
    }

    const filename = `thumbnail-${record.ratio.toLowerCase().replace(/_/g, '-')}.jpg`;
    const disposition = download === '1' ? 'attachment' : 'inline';
    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(deliverLocalFile(record.exportPath));
  }
}
