import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateStorageSettingsDto {
  @IsOptional()
  @IsBoolean()
  r2Enabled?: boolean;

  @IsOptional()
  @IsString()
  r2AccountId?: string;

  @IsOptional()
  @IsString()
  r2AccessKeyId?: string;

  @IsOptional()
  @IsString()
  r2SecretAccessKey?: string;

  @IsOptional()
  @IsString()
  r2BucketName?: string;

  @IsOptional()
  @IsString()
  r2PublicUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  videoRetentionHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  thumbnailRetentionDays?: number;
}
