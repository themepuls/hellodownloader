import { Global, Module } from '@nestjs/common';
import { ThumbnailPromptsService } from './thumbnail-prompts.service';
import { ThumbnailPromptsController } from './thumbnail-prompts.controller';

@Global()
@Module({
  controllers: [ThumbnailPromptsController],
  providers: [ThumbnailPromptsService],
  exports: [ThumbnailPromptsService],
})
export class ThumbnailPromptsModule {}
