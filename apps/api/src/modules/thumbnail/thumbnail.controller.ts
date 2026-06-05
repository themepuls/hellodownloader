import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ThumbnailService, type ThumbnailMode } from './thumbnail.service';
import { IsEnum, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { PlanType, ThumbnailRatio } from '@hellodownloader/shared-types';
import { Public } from '../auth/public.decorator';

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
}

@Controller('thumbnails')
export class ThumbnailController {
  constructor(private thumbnailService: ThumbnailService) {}

  @Public()
  @Post('original')
  getOriginal(@Body() dto: OriginalThumbnailDto) {
    return this.thumbnailService.getOriginalThumbnail(dto.url);
  }

  @Post('ai')
  createAi(
    @Req() req: { user: { id: string; plan: string } },
    @Body() dto: CreateThumbnailDto,
  ) {
    return this.thumbnailService.createAi(
      req.user.id,
      req.user.plan as PlanType,
      dto.videoUrl,
      dto.ratio,
      dto.mode,
      dto.prompt,
    );
  }

  @Post('original/save')
  recordOriginal(
    @Req() req: { user: { id: string } },
    @Body() dto: OriginalThumbnailDto,
  ) {
    return this.thumbnailService.recordOriginalDownload(req.user.id, dto.url);
  }

  @Get()
  findAll(@Req() req: { user: { id: string } }) {
    return this.thumbnailService.findAll(req.user.id);
  }
}
