import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  composeThumbnailPromptPreview,
  DEFAULT_ADJUST_THUMBNAIL_PROMPT,
  DEFAULT_CATEGORY_THUMBNAIL_PROMPTS,
  DEFAULT_GLOBAL_THUMBNAIL_PROMPT,
  slugifyThumbnailPromptName,
  type ThumbnailPromptPreviewInput,
  type ThumbnailPromptPreviewResult,
  type ThumbnailPromptRecord,
  type ThumbnailPromptStatus,
  type ThumbnailPromptType,
} from '@hellodownloader/shared-types';
import type { CreateThumbnailPromptDto, UpdateThumbnailPromptDto } from './thumbnail-prompts.dto';

type DbType = 'GLOBAL' | 'CATEGORY' | 'ADJUST';
type DbStatus = 'ENABLED' | 'DISABLED';

function toApiType(type: DbType): ThumbnailPromptType {
  return type.toLowerCase() as ThumbnailPromptType;
}

function toDbType(type: ThumbnailPromptType): DbType {
  return type.toUpperCase() as DbType;
}

function toApiStatus(status: DbStatus): ThumbnailPromptStatus {
  return status.toLowerCase() as ThumbnailPromptStatus;
}

function toDbStatus(status: ThumbnailPromptStatus): DbStatus {
  return status.toUpperCase() as DbStatus;
}

@Injectable()
export class ThumbnailPromptsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private toRecord(row: {
    id: string;
    name: string;
    slug: string;
    type: DbType;
    content: string;
    status: DbStatus;
    createdAt: Date;
    updatedAt: Date;
  }): ThumbnailPromptRecord {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: toApiType(row.type),
      content: row.content,
      status: toApiStatus(row.status),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async seedDefaults() {
    const existing = await this.prisma.thumbnailPrompt.count();
    if (existing > 0) return;

    await this.prisma.thumbnailPrompt.createMany({
      data: [
        {
          name: 'Global Thumbnail Prompt',
          slug: 'global',
          type: 'GLOBAL',
          content: DEFAULT_GLOBAL_THUMBNAIL_PROMPT,
          status: 'ENABLED',
        },
        {
          name: 'AI Adjust Thumbnail',
          slug: 'ai-adjust-thumbnail',
          type: 'ADJUST',
          content: DEFAULT_ADJUST_THUMBNAIL_PROMPT,
          status: 'ENABLED',
        },
        ...DEFAULT_CATEGORY_THUMBNAIL_PROMPTS.map((item) => ({
          name: item.name,
          slug: item.slug,
          type: 'CATEGORY' as const,
          content: item.content,
          status: 'ENABLED' as const,
        })),
      ],
    });
  }

  async findAll(params?: { type?: ThumbnailPromptType; search?: string }) {
    const where: {
      type?: DbType;
      OR?: Array<{ name?: { contains: string }; slug?: { contains: string }; content?: { contains: string } }>;
    } = {};

    if (params?.type) {
      where.type = toDbType(params.type);
    }

    const search = params?.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { content: { contains: search } },
      ];
    }

    const rows = await this.prisma.thumbnailPrompt.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async findById(id: string) {
    const row = await this.prisma.thumbnailPrompt.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Prompt not found');
    return this.toRecord(row);
  }

  async findBySlug(slug: string) {
    const row = await this.prisma.thumbnailPrompt.findUnique({ where: { slug } });
    return row ? this.toRecord(row) : null;
  }

  async create(dto: CreateThumbnailPromptDto) {
    const slug = (dto.slug?.trim() || slugifyThumbnailPromptName(dto.name)).toLowerCase();
    if (!slug) throw new BadRequestException('Slug is required');

    const conflict = await this.prisma.thumbnailPrompt.findUnique({ where: { slug } });
    if (conflict) throw new BadRequestException('A prompt with this slug already exists');

    if (dto.type === 'global') {
      const existingGlobal = await this.prisma.thumbnailPrompt.findFirst({
        where: { type: 'GLOBAL' },
      });
      if (existingGlobal) {
        throw new BadRequestException('Only one global prompt is allowed. Edit the existing global prompt.');
      }
    }

    if (dto.type === 'adjust') {
      const existingAdjust = await this.prisma.thumbnailPrompt.findFirst({
        where: { type: 'ADJUST' },
      });
      if (existingAdjust) {
        throw new BadRequestException('Only one adjust prompt is allowed. Edit the existing adjust prompt.');
      }
    }

    const row = await this.prisma.thumbnailPrompt.create({
      data: {
        name: dto.name.trim(),
        slug,
        type: toDbType(dto.type),
        content: dto.content,
        status: toDbStatus(dto.status ?? 'enabled'),
      },
    });

    return this.toRecord(row);
  }

  async update(id: string, dto: UpdateThumbnailPromptDto) {
    const existing = await this.prisma.thumbnailPrompt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prompt not found');

    if (dto.slug && dto.slug !== existing.slug) {
      const conflict = await this.prisma.thumbnailPrompt.findUnique({ where: { slug: dto.slug } });
      if (conflict) throw new BadRequestException('A prompt with this slug already exists');
    }

    if (dto.type && dto.type !== toApiType(existing.type)) {
      if (dto.type === 'global' || existing.type === 'GLOBAL') {
        throw new BadRequestException('Global prompt type cannot be changed');
      }
      if (dto.type === 'adjust' || existing.type === 'ADJUST') {
        throw new BadRequestException('Adjust prompt type cannot be changed');
      }
    }

    const row = await this.prisma.thumbnailPrompt.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        slug: dto.slug?.trim().toLowerCase(),
        type: dto.type ? toDbType(dto.type) : undefined,
        content: dto.content,
        status: dto.status ? toDbStatus(dto.status) : undefined,
      },
    });

    return this.toRecord(row);
  }

  async delete(id: string) {
    const existing = await this.prisma.thumbnailPrompt.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prompt not found');

    if (existing.type === 'GLOBAL' || existing.type === 'ADJUST') {
      throw new BadRequestException('Global and adjust prompts cannot be deleted. Disable them instead.');
    }

    await this.prisma.thumbnailPrompt.delete({ where: { id } });
    return { ok: true };
  }

  private async getEnabledContent(type: DbType, slug?: string): Promise<string | null> {
    if (type === 'CATEGORY' && slug) {
      const row = await this.prisma.thumbnailPrompt.findFirst({
        where: { type: 'CATEGORY', slug, status: 'ENABLED' },
      });
      return row?.content?.trim() || null;
    }

    const row = await this.prisma.thumbnailPrompt.findFirst({
      where: { type, status: 'ENABLED' },
      orderBy: { updatedAt: 'desc' },
    });
    return row?.content?.trim() || null;
  }

  async buildPreview(input: ThumbnailPromptPreviewInput): Promise<ThumbnailPromptPreviewResult> {
    const mode = input.mode ?? 'generate';
    const global = await this.getEnabledContent('GLOBAL');
    const category = input.categorySlug
      ? await this.getEnabledContent('CATEGORY', input.categorySlug.trim())
      : null;
    const adjust = mode === 'adjust' ? await this.getEnabledContent('ADJUST') : null;

    return composeThumbnailPromptPreview({
      global,
      category,
      adjust,
      strategy: input.strategyPrompt,
      instructions: input.userInstructions,
      mode,
    });
  }

  async composeStrategyPrompt(basePrompt: string, categorySlug?: string): Promise<string> {
    const preview = await this.buildPreview({
      categorySlug,
      mode: 'generate',
      strategyPrompt: basePrompt,
    });
    return preview.preview || basePrompt;
  }

  async composeGeneratePrompt(
    strategyPrompt: string,
    categorySlug?: string,
    userInstructions?: string,
  ): Promise<string> {
    const preview = await this.buildPreview({
      categorySlug,
      mode: 'generate',
      strategyPrompt,
      userInstructions,
    });
    return preview.preview || strategyPrompt;
  }

  async composeAdjustPrompt(categorySlug?: string): Promise<string> {
    const preview = await this.buildPreview({
      categorySlug,
      mode: 'adjust',
    });
    return preview.preview;
  }

  async getAdjustInstructions(): Promise<string | null> {
    return this.getEnabledContent('ADJUST');
  }
}
