import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { DownloadType } from '@hellodownloader/shared-types';

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
}
