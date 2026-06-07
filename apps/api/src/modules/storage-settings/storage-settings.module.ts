import { Module } from '@nestjs/common';
import { StorageSettingsService } from './storage-settings.service';

@Module({
  providers: [StorageSettingsService],
  exports: [StorageSettingsService],
})
export class StorageSettingsModule {}
