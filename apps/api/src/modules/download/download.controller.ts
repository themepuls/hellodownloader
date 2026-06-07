import {
  Body,
  Controller,
  Get,
  Head,
  Headers,
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
import { StorageService } from '../../services/storage.service';
import { fromR2Reference, isR2Reference } from '../../utils/r2-storage';
import { buildDownloadFilename, contentDispositionAttachment } from '../../utils/download-filename';

type AuthUser = { id: string; plan: string; role?: string };

function readDownloadToken(
  headerToken: string | undefined,
  queryToken: string | undefined,
): string | undefined {
  return headerToken?.trim() || queryToken?.trim() || undefined;
}

@Controller('downloads')
export class DownloadController {
  constructor(
    private downloadService: DownloadService,
    private storage: StorageService,
  ) {}

  private accessOpts(
    req: { user?: AuthUser | null },
    headerToken?: string,
    queryToken?: string,
  ) {
    return {
      userId: req.user?.id,
      accessToken: readDownloadToken(headerToken, queryToken),
    };
  }

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
  getStatus(
    @Req() req: { user?: AuthUser | null },
    @Param('id') id: string,
    @Headers('x-download-token') headerToken?: string,
    @Query('download_token') queryToken?: string,
  ) {
    return this.downloadService.getStatusById(id, this.accessOpts(req, headerToken, queryToken));
  }

  @Public()
  @Post(':id/release')
  async releaseFile(
    @Req() req: { user?: AuthUser | null },
    @Param('id') id: string,
    @Headers('x-download-token') headerToken?: string,
    @Query('download_token') queryToken?: string,
  ) {
    const record = await this.downloadService.getFilePath(id, this.accessOpts(req, headerToken, queryToken));
    if (!record?.filePath) {
      return { ok: true, message: 'File already removed' };
    }
    await this.downloadService.releaseStoredFile(id, record.filePath);
    return { ok: true };
  }

  @Public()
  @Post(':id/confirm-save')
  async confirmSave(
    @Req() req: { user?: AuthUser | null },
    @Param('id') id: string,
    @Headers('x-download-token') headerToken?: string,
    @Query('download_token') queryToken?: string,
  ) {
    const record = await this.downloadService.getFilePath(id, this.accessOpts(req, headerToken, queryToken));
    if (!record?.filePath) {
      return { ok: true, message: 'File already removed' };
    }
    await this.downloadService.releaseFileAfterDelivery(id, record.filePath);
    return { ok: true };
  }

  @Public()
  @Get(':id/file')
  async downloadFile(
    @Req() req: { user?: AuthUser | null },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-download-token') headerToken?: string,
    @Query('download_token') queryToken?: string,
  ) {
    return this.serveDownloadFile(id, this.accessOpts(req, headerToken, queryToken), res, false);
  }

  @Public()
  @Head(':id/file')
  async headDownloadFile(
    @Req() req: { user?: AuthUser | null },
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-download-token') headerToken?: string,
    @Query('download_token') queryToken?: string,
  ) {
    return this.serveDownloadFile(id, this.accessOpts(req, headerToken, queryToken), res, true);
  }

  private serveDownloadFile(
    id: string,
    accessOpts: { userId?: string; accessToken?: string },
    res: Response,
    headOnly = false,
  ) {
    return (async () => {
      const record = await this.downloadService.getFilePath(id, accessOpts);
      if (!record || record.status !== 'COMPLETED') {
        throw new NotFoundException('File not ready yet');
      }
      if (!record.filePath) {
        throw new NotFoundException(
          'File no longer on server (already saved or expired). Download again from the same URL.',
        );
      }

      const recordType = (record as { type?: string }).type;
      const filename = buildDownloadFilename(record.title, recordType, record.id);
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

      if (isR2Reference(record.filePath)) {
        const { body, size, contentType: r2Type } = await this.storage.openR2Object(
          fromR2Reference(record.filePath),
        );
        res.set({
          'Content-Type': r2Type || contentType,
          'Content-Length': String(size),
          'Content-Disposition': contentDispositionAttachment(filename),
          'Accept-Ranges': 'bytes',
        });
        if (headOnly) return;
        return new StreamableFile(body);
      }

      if (!existsSync(record.filePath)) {
        throw new NotFoundException(
          'File no longer on server (already saved or expired). Download again from the same URL.',
        );
      }

      utimesSync(record.filePath, new Date(), new Date());

      const stat = statSync(record.filePath);
      res.set({
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Content-Disposition': contentDispositionAttachment(filename),
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
