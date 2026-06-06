import { Controller, Get, Header, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SiteSettingsService } from '../site-settings/site-settings.service';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(
    private content: ContentService,
    private siteSettings: SiteSettingsService,
  ) {}

  @Public()
  @Get('pages')
  listPublicSitemapPages() {
    return this.content.listPublicSitemapPages();
  }

  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.content.getPage(slug);
  }

  @Public()
  @Get('site-settings')
  getSiteSettings() {
    return this.siteSettings.getPublic();
  }

  @Public()
  @Get('verification/:filename')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getVerificationFile(@Param('filename') filename: string) {
    return this.siteSettings.getVerificationFile(filename);
  }
}
