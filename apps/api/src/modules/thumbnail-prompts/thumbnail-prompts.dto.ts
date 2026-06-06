import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  THUMBNAIL_PROMPT_STATUSES,
  THUMBNAIL_PROMPT_TYPES,
  type ThumbnailPromptStatus,
  type ThumbnailPromptType,
} from '@hellodownloader/shared-types';

export class CreateThumbnailPromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsIn([...THUMBNAIL_PROMPT_TYPES])
  type!: ThumbnailPromptType;

  @IsString()
  @MaxLength(20000)
  content!: string;

  @IsOptional()
  @IsIn([...THUMBNAIL_PROMPT_STATUSES])
  status?: ThumbnailPromptStatus;
}

export class UpdateThumbnailPromptDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsIn([...THUMBNAIL_PROMPT_TYPES])
  type?: ThumbnailPromptType;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @IsOptional()
  @IsIn([...THUMBNAIL_PROMPT_STATUSES])
  status?: ThumbnailPromptStatus;
}

export class PreviewThumbnailPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

  @IsOptional()
  @IsIn(['generate', 'adjust'])
  mode?: 'generate' | 'adjust';

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  strategyPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  userInstructions?: string;
}
