import { BadRequestException, Injectable } from '@nestjs/common';
import {
  buildThumbnailStrategyPrompt,
  normalizeThumbnailStrategyResult,
  resolveThumbnailRatioLabel,
  resolveThumbnailTextStyleLabel,
  type ThumbnailStrategyResult,
} from '@hellodownloader/shared-types';
import { AiApiSettingsService } from '../ai-api-settings/ai-api-settings.service';
import { assertAllowedThumbnailUrl } from '../../utils/safe-url';

import { ThumbnailPromptsService } from '../thumbnail-prompts/thumbnail-prompts.service';

export type GenerateStrategyInput = {
  title: string;
  category?: string;
  categorySlug?: string;
  textStyle?: string;
  ratio?: string;
  instructions?: string;
  thumbnailUrl?: string;
};

@Injectable()
export class ThumbnailHeadlineService {
  constructor(
    private aiApiSettings: AiApiSettingsService,
    private thumbnailPrompts: ThumbnailPromptsService,
  ) {}

  async generateHeadline(input: GenerateStrategyInput): Promise<ThumbnailStrategyResult> {
    if (!input.title?.trim()) {
      throw new BadRequestException('Video title is required');
    }

    const config = await this.aiApiSettings.getCredentials();
    if (!config.features.enableAiAnalysis) {
      throw new BadRequestException('AI analysis is disabled in Admin → API Settings.');
    }
    if (!config.openaiApiKey?.trim()) {
      throw new BadRequestException('Configure OpenAI in Admin → API Settings.');
    }

    const categoryLabel = input.category?.trim() || 'Auto Detect';
    const hasImage = Boolean(input.thumbnailUrl?.trim());

    const promptText = await this.thumbnailPrompts.composeStrategyPrompt(
      buildThumbnailStrategyPrompt({
        title: input.title,
        category: categoryLabel,
        textStyle: input.textStyle,
        ratio: resolveThumbnailRatioLabel(input.ratio),
        instructions: input.instructions,
        imageAnalysis: hasImage
          ? 'Analyze the attached thumbnail image for faces, subjects, empty areas, and safe text zones.'
          : undefined,
      }),
      input.categorySlug,
    );

    type ContentPart =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const userContent: ContentPart[] = [{ type: 'text', text: promptText }];
    if (hasImage) {
      const safeThumbnailUrl = assertAllowedThumbnailUrl(input.thumbnailUrl!.trim());
      userContent.push({ type: 'image_url', image_url: { url: safeThumbnailUrl } });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.textModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a world-class YouTube thumbnail strategist and viral CTR expert. Analyze the title and image when provided. Follow instructions exactly and return valid JSON only.',
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new BadRequestException(
        `OpenAI request failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new BadRequestException('OpenAI returned an empty response');
    }

    let parsed: Partial<ThumbnailStrategyResult>;
    try {
      parsed = JSON.parse(raw) as Partial<ThumbnailStrategyResult>;
    } catch {
      throw new BadRequestException('OpenAI returned invalid JSON');
    }

    return normalizeThumbnailStrategyResult(parsed, {
      category: categoryLabel,
      textStyle: resolveThumbnailTextStyleLabel(input.textStyle),
    });
  }
}
