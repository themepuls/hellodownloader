import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { ContentService } from './content.service';

@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Public()
  @Get('pages/:slug')
  getPage(@Param('slug') slug: string) {
    return this.content.getPage(slug);
  }
}
