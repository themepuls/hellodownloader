import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import {
  BASIC_IMAGE_MODELS,
  IMAGE_PROVIDERS,
  OPENAI_TEXT_MODELS,
  PRO_IMAGE_MODELS,
  type BasicImageModel,
  type ImageProvider,
  type ProImageModel,
} from '@hellodownloader/shared-types';

function IsAllowedModel(
  allowed: readonly string[],
  label: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: `is${label}ImageModel`,
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && allowed.includes(value);
        },
        defaultMessage() {
          return `${propertyName} must be one of: ${allowed.join(', ')}`;
        },
      },
    });
  };
}

export class TestOpenAiDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsIn([...OPENAI_TEXT_MODELS])
  textModel!: (typeof OPENAI_TEXT_MODELS)[number];
}

export class TestFalDto {
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class SaveAiProvidersDto {
  @IsIn([...OPENAI_TEXT_MODELS])
  textModel!: (typeof OPENAI_TEXT_MODELS)[number];

  @IsIn([...IMAGE_PROVIDERS])
  imageProvider!: ImageProvider;

  @IsAllowedModel(BASIC_IMAGE_MODELS, 'Basic')
  basicImageModel!: BasicImageModel;

  @IsAllowedModel(PRO_IMAGE_MODELS, 'Pro')
  proImageModel!: ProImageModel;

  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  openaiVerificationToken?: string;

  @IsOptional()
  @IsString()
  falApiKey?: string;

  @IsOptional()
  @IsString()
  falVerificationToken?: string;
}

export class SaveAiFeaturesDto {
  @IsOptional()
  @IsBoolean()
  enableAiAnalysis?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAiThumbnailGeneration?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAiImproveThumbnail?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoCategoryDetection?: boolean;

  @IsOptional()
  @IsBoolean()
  enableThumbnailScoring?: boolean;

  @IsOptional()
  @IsBoolean()
  enableAutoLayoutDetection?: boolean;
}
