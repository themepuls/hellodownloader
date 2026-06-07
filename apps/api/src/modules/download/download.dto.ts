import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DownloadType } from '@hellodownloader/shared-types';

/** Metadata from a prior analyze call — skips a second yt-dlp round-trip on create. */
export class CachedDownloadMetadataDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  title!: string;

  @IsString()
  thumbnail!: string;

  @IsOptional()
  @IsString()
  uploader?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsArray()
  formats?: unknown[];
}

export class CreateDownloadDto {
  @IsUrl()
  url!: string;

  @IsEnum(DownloadType)
  type!: DownloadType;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsInt()
  @Min(144)
  @Max(4320)
  quality?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CachedDownloadMetadataDto)
  metadata?: CachedDownloadMetadataDto;
}
