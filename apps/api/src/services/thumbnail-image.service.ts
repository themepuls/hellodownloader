import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildAdjustVisionImagePrompt,
  buildGenerateAiPrompt,
  resolveImageModelForPlan,
  type ImageProvider,
} from '@hellodownloader/shared-types';
import { AiApiSettingsService } from '../modules/ai-api-settings/ai-api-settings.service';
import { analyzeAdjustVision } from '../thumbnail-engine/analyze/adjust-vision';
import sharp from '../utils/load-sharp';
import {
  resolveFalAspectRatio,
  resolveFalImageEndpoint,
  resolveOpenAiImageSize,
  resolveThumbnailPixels,
} from '@hellodownloader/shared-types';

export type GenerateThumbnailImageInput = {
  referenceImagePath: string;
  outputPath: string;
  mode: 'adjust' | 'generate';
  ratio: string;
  prompt?: string;
  adjustPrompt?: string;
  ocrLines?: string[];
  fullOcrText?: string;
  planModel?: string;
  plan?: 'FREE' | 'PRO';
};

@Injectable()
export class ThumbnailImageService {
  private readonly logger = new Logger(ThumbnailImageService.name);

  constructor(private aiSettings: AiApiSettingsService) {}

  async generate(input: GenerateThumbnailImageInput): Promise<void> {
    const config = await this.aiSettings.getCredentials();
    const provider = config.imageProvider as ImageProvider;
    const imageModel =
      input.planModel ??
      resolveImageModelForPlan(input.plan ?? 'FREE', {
        basicImageModel: config.basicImageModel,
        proImageModel: config.proImageModel,
      });

    if (input.mode === 'adjust' && !config.features.enableAiImproveThumbnail) {
      throw new BadRequestException('AI thumbnail adjust is disabled in Admin → API Settings.');
    }
    if (input.mode === 'generate' && !config.features.enableAiThumbnailGeneration) {
      throw new BadRequestException('AI thumbnail generation is disabled in Admin → API Settings.');
    }

    if (input.mode === 'adjust' && !config.features.enableAiAnalysis) {
      throw new BadRequestException(
        'Enable AI Analysis in Admin → API Settings — required for thumbnail vision.',
      );
    }

    let prompt = '';

    if (input.mode === 'adjust') {
      const openaiKey = config.openaiApiKey?.trim();
      if (!openaiKey) {
        throw new BadRequestException(
          'OpenAI API key required for AI vision analysis (Admin → API Settings → Text AI).',
        );
      }

      this.logger.log('Analyzing original thumbnail with AI vision');
      let visionPlan;
      try {
        visionPlan = await analyzeAdjustVision({
          apiKey: openaiKey,
          model: config.textModel,
          imagePath: input.referenceImagePath,
          ratio: input.ratio,
          ocrLines: input.ocrLines,
          fullOcrText: input.fullOcrText,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Vision analysis failed';
        throw new BadRequestException(`AI vision failed: ${msg}`);
      }

      if (!visionPlan) {
        throw new BadRequestException(
          'Could not analyze thumbnail with AI vision. Try again or use a clearer source image.',
        );
      }

      prompt = buildAdjustVisionImagePrompt({
        adminPrompt: input.adjustPrompt ?? '',
        ratio: input.ratio,
        plan: visionPlan,
      });
      this.logger.log(
        `Vision plan: ${visionPlan.textBlocks.length} text blocks, ${visionPlan.subjects.length} subjects (proofread)`,
      );
    } else {
      prompt = buildGenerateAiPrompt(input.prompt ?? '', input.ratio);
    }

    if (!prompt.trim()) {
      throw new BadRequestException('Could not build thumbnail prompt.');
    }

    this.logger.log(
      `Image generation: provider=${provider}, model=${imageModel}, mode=${input.mode}`,
    );

    if (provider === 'openai') {
      if (!config.openaiApiKey?.trim()) {
        throw new BadRequestException('Configure OpenAI in Admin → API Settings.');
      }
      await this.generateOpenAi({
        apiKey: config.openaiApiKey.trim(),
        referenceImagePath: input.referenceImagePath,
        outputPath: input.outputPath,
        prompt,
        ratio: input.ratio,
        mode: input.mode,
        model: imageModel,
      });
      if (input.mode === 'adjust') {
        await this.normalizeOutputSize(input.outputPath, input.ratio);
      }
      return;
    }

    if (!config.falApiKey?.trim()) {
      throw new BadRequestException('Configure fal.ai in Admin → API Settings.');
    }

    await this.generateFal({
      apiKey: config.falApiKey.trim(),
      referenceImagePath: input.referenceImagePath,
      outputPath: input.outputPath,
      prompt,
      ratio: input.ratio,
      mode: input.mode,
      model: imageModel,
      plan: input.plan,
    });

    if (input.mode === 'adjust') {
      await this.normalizeOutputSize(input.outputPath, input.ratio);
    }
  }

  private imageToDataUri(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  private async downloadToFile(url: string, outputPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new BadRequestException(`Failed to download generated image (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
  }

  private async generateFal(input: {
    apiKey: string;
    referenceImagePath: string;
    outputPath: string;
    prompt: string;
    ratio: string;
    mode: 'adjust' | 'generate';
    model: string;
    plan?: 'FREE' | 'PRO';
  }): Promise<void> {
    const endpoint = resolveFalImageEndpoint(input.model, input.mode, input.plan);
    const referenceDataUri = this.imageToDataUri(input.referenceImagePath);
    const aspectRatio = resolveFalAspectRatio(input.ratio);

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      num_images: 1,
      output_format: 'jpeg',
      guidance_scale: input.mode === 'adjust' ? 5.5 : 3.5,
      safety_tolerance: '2',
      enhance_prompt: false,
    };

    if (input.mode === 'adjust' || endpoint.includes('kontext')) {
      body.image_url = referenceDataUri;
    }

    this.logger.log(`Calling fal ${endpoint} model=${input.model} (${aspectRatio})`);

    const res = await fetch(`https://fal.run/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new BadRequestException(
        `fal.ai image generation failed (${res.status})${errText ? `: ${errText.slice(0, 240)}` : ''}`,
      );
    }

    const data = (await res.json()) as {
      images?: Array<{ url?: string }>;
      image?: { url?: string };
      url?: string;
    };

    const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.url;

    if (!resultUrl) {
      throw new BadRequestException('fal.ai returned no image URL');
    }

    await this.downloadToFile(resultUrl, input.outputPath);
  }

  private async generateOpenAi(input: {
    apiKey: string;
    referenceImagePath: string;
    outputPath: string;
    prompt: string;
    ratio: string;
    mode: 'adjust' | 'generate';
    model: string;
  }): Promise<void> {
    const size = resolveOpenAiImageSize(input.ratio);

    if (input.mode === 'adjust') {
      this.logger.log(`Calling OpenAI ${input.model} edit (${size})`);
      const form = new FormData();
      const bytes = fs.readFileSync(input.referenceImagePath);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      form.append('model', input.model);
      form.append('prompt', input.prompt);
      form.append('size', size);
      form.append('quality', 'high');
      form.append('image', blob, path.basename(input.referenceImagePath));

      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${input.apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new BadRequestException(
          `OpenAI image edit failed (${res.status})${errText ? `: ${errText.slice(0, 240)}` : ''}`,
        );
      }

      const data = (await res.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const item = data.data?.[0];
      if (item?.b64_json) {
        fs.writeFileSync(input.outputPath, Buffer.from(item.b64_json, 'base64'));
        return;
      }
      if (item?.url) {
        await this.downloadToFile(item.url, input.outputPath);
        return;
      }
      throw new BadRequestException('OpenAI returned no image data');
    }

    this.logger.log(`Calling OpenAI ${input.model} generate (${size})`);
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size,
        n: 1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new BadRequestException(
        `OpenAI image generation failed (${res.status})${errText ? `: ${errText.slice(0, 240)}` : ''}`,
      );
    }

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (item?.b64_json) {
      fs.writeFileSync(input.outputPath, Buffer.from(item.b64_json, 'base64'));
      return;
    }
    if (item?.url) {
      await this.downloadToFile(item.url, input.outputPath);
      return;
    }
    throw new BadRequestException('OpenAI returned no image data');
  }

  /** Upscale provider output to exact export pixels (e.g. 1024×1536 → 1080×1920). */
  private async normalizeOutputSize(outputPath: string, ratio: string): Promise<void> {
    const { width, height } = resolveThumbnailPixels(ratio);
    const tmp = `${outputPath}.norm.jpg`;
    await sharp(outputPath)
      .resize(width, height, { fit: 'fill' })
      .sharpen()
      .jpeg({ quality: 94 })
      .toFile(tmp);
    fs.renameSync(tmp, outputPath);
  }
}
