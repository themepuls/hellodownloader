import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import {
  BASIC_PLAN_MODELS,
  OPENAI_MODELS,
  PRO_PLAN_MODELS,
  type BasicPlanModel,
  type ProPlanModel,
} from '@hellodownloader/shared-types';

function IsPlanModel(
  allowed: readonly string[],
  label: string,
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: `is${label}PlanModel`,
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && allowed.includes(value);
        },
        defaultMessage() {
          return `${propertyName} must be one of the following values: ${allowed.join(', ')}`;
        },
      },
    });
  };
}

export class TestOpenAiDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;

  @IsIn([...OPENAI_MODELS])
  openaiModel!: (typeof OPENAI_MODELS)[number];
}

export class SaveOpenAiDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsIn([...OPENAI_MODELS])
  openaiModel!: (typeof OPENAI_MODELS)[number];

  @IsOptional()
  @IsString()
  verificationToken?: string;
}

export class TestFreepikDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}

export class SaveFreepikDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  verificationToken?: string;
}

export class SavePlanModelsDto {
  @IsPlanModel(BASIC_PLAN_MODELS, 'Basic')
  basicPlanModel!: BasicPlanModel;

  @IsPlanModel(PRO_PLAN_MODELS, 'Pro')
  proPlanModel!: ProPlanModel;
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
