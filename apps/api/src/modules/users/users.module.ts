import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { StorageSettingsModule } from '../storage-settings/storage-settings.module';

@Module({
  imports: [StorageSettingsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
