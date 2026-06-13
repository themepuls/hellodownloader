import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { PlaylistService } from './playlist.service';
import { IsOptional, IsUrl, IsInt, Min, Max } from 'class-validator';
import { PlanType } from '@hellodownloader/shared-types';

class CreatePlaylistDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(360)
  @Max(2160)
  quality?: number;
}

@Controller('playlists')
export class PlaylistController {
  constructor(private playlistService: PlaylistService) {}

  @Post()
  create(
    @Req() req: { user: { id: string; plan: string } },
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistService.create(
      req.user.id,
      req.user.plan as PlanType,
      dto.url,
      dto.quality,
    );
  }

  @Get()
  findAll(@Req() req: { user: { id: string } }) {
    return this.playlistService.findAll(req.user.id);
  }

  @Get(':id/status')
  getStatus(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.playlistService.getStatus(req.user.id, id);
  }

  @Post(':id/confirm-save')
  async confirmSave(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    const record = await this.playlistService.getFileForUser(req.user.id, id);
    if (!record.zipPath) {
      return { ok: true, message: 'File already removed' };
    }
    await this.playlistService.releaseZipAfterDelivery(id, record.zipPath);
    return { ok: true };
  }

  @Get(':id/file')
  async downloadFile(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const record = await this.playlistService.getFileForUser(req.user.id, id);
    const { stream, filename, safeName } = await this.playlistService.getFileStream(record.zipPath!);

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });

    return new StreamableFile(stream);
  }
}
