import {
  Body,
  Controller,
  Get,
  Head,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { existsSync, statSync, utimesSync } from 'fs';
import * as path from 'path';
import { DownloadService } from './download.service';
import { CreateDownloadDto } from './download.dto';
import { Public } from '../auth/public.decorator';
import { PlanType } from '@hellodownloader/shared-types';
import { deliverLocalFile } from '../../utils/file-delivery';

type AuthUser = { id: string; plan: string; role?: string };

@Controller('downloads')
export class DownloadController {
  constructor(private downloadService: DownloadService) {}

  @Public()
  @Get('quality-access')
  getQualityAccess() {
    return this.downloadService.getQualityAccess();
  }

  @Public()
  @Post('metadata')
  getMetadata(@Body('url') url: string) {
    return this.downloadService.getMetadata(url);
  }

  @Public()
  @Get('thumbnail-proxy')
  proxyThumbnail(@Query('url') url: string, @Res() res: Response) {
    return this.downloadService.proxyThumbnail(url, res);
  }

  @Public()
  @Post()
  create(@Req() req: { user?: AuthUser }, @Body() dto: CreateDownloadDto) {
    return this.downloadService.createForRequest(req.user, dto);
  }

  @Public()
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.downloadService.getStatusById(id);
  }

  @Public()
  @Post(':id/release')
  async releaseFile(@Param('id') id: string) {
    const record = await this.downloadService.getFilePath(id);
    if (!record?.filePath) {
      return { ok: true, message: 'File already removed' };
    }
    await this.downloadService.releaseStoredFile(id, record.filePath);
    return { ok: true };
  }

  @Public()
  @Post(':id/confirm-save')
  async confirmSave(@Param('id') id: string) {
    const record = await this.downloadService.getFilePath(id);
    if (!record?.filePath) {
      return { ok: true, message: 'File already removed' };
    }
    await this.downloadService.releaseFileAfterDelivery(id, record.filePath);
    return { ok: true };
  }

  @Public()
  @Get(':id/file')
  async downloadFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return this.serveDownloadFile(id, res);
  }

  @Public()
  @Head(':id/file')
  async headDownloadFile(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return this.serveDownloadFile(id, res, true);
  }

  private serveDownloadFile(id: string, res: Response, headOnly = false) {
    return (async () => {
      const record = await this.downloadService.getFilePath(id);
      if (!record || record.status !== 'COMPLETED') {
        throw new NotFoundException('File not ready yet');
      }
      if (!record.filePath || !existsSync(record.filePath)) {
        throw new NotFoundException(
          'File no longer on server (already saved or expired). Download again from the same URL.',
        );
      }

      utimesSync(record.filePath, new Date(), new Date());

      let filename = path.basename(record.filePath);
      const recordType = (record as { type?: string }).type;
      if (recordType === 'MP3' && !filename.toLowerCase().endsWith('.mp3')) {
        filename = `${filename.replace(/\.[^.]+$/, '')}.mp3`;
      }
      const safeName = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
      const stat = statSync(record.filePath);
      const ext = path.extname(filename).toLowerCase();
      const contentType =
        ext === '.mp3' || recordType === 'MP3'
          ? 'audio/mpeg'
          : ext === '.m4a'
            ? 'audio/mp4'
            : ext === '.mp4'
              ? 'video/mp4'
              : ext === '.webm'
                ? 'video/webm'
                : 'application/octet-stream';
      res.set({
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Accept-Ranges': 'bytes',
      });

      if (headOnly) return;

      return new StreamableFile(deliverLocalFile(record.filePath));
    })();
  }

  @Get()
  findAll(
    @Req() req: { user: AuthUser },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.downloadService.findAll(
      req.user.id,
      req.user.plan as PlanType,
      parseInt(page ?? '1', 10),
      parseInt(limit ?? '20', 10),
    );
  }

  @Get(':id')
  findOne(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.downloadService.findOne(req.user.id, id);
  }
}
