import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DEFAULT_CONTENT_PAGES, mergeContent, mergePageSections } from '@hellodownloader/shared-types';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ContentService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaults();
  }

  async ensureDefaults() {
    for (const page of DEFAULT_CONTENT_PAGES) {
      await this.prisma.contentPage.upsert({
        where: { slug: page.slug },
        create: {
          slug: page.slug,
          title: page.title,
          sections: page.sections as object,
          published: true,
        },
        update: { title: page.title },
      });
    }
  }

  private mergeWithDefaults(slug: string, sections: Record<string, unknown> | null) {
    return mergePageSections(slug, sections);
  }

  async getPage(slug: string, opts?: { includeUnpublished?: boolean }) {
    const row = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (!row) throw new NotFoundException('Page not found');
    if (!row.published && !opts?.includeUnpublished) {
      throw new NotFoundException('Page not found');
    }
    return {
      slug: row.slug,
      title: row.title,
      published: row.published,
      sections: this.mergeWithDefaults(row.slug, row.sections as Record<string, unknown> | null),
      updatedAt: row.updatedAt,
    };
  }

  async listPages() {
    const rows = await this.prisma.contentPage.findMany({ orderBy: { slug: 'asc' } });
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      published: row.published,
      sections: this.mergeWithDefaults(row.slug, row.sections as Record<string, unknown> | null),
      updatedAt: row.updatedAt,
    }));
  }

  /** Published pages for sitemap.xml — slug, updatedAt, noIndex only. */
  async listPublicSitemapPages() {
    const rows = await this.prisma.contentPage.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true, sections: true },
      orderBy: { slug: 'asc' },
    });

    return rows.map((row) => {
      const sections = this.mergeWithDefaults(row.slug, row.sections as Record<string, unknown> | null);
      const seo = sections.seo as { noIndex?: boolean } | undefined;
      return {
        slug: row.slug,
        updatedAt: row.updatedAt.toISOString(),
        noIndex: Boolean(seo?.noIndex),
      };
    });
  }

  async updatePage(
    slug: string,
    data: {
      title?: string;
      published?: boolean;
      sections?: Record<string, unknown>;
    },
  ) {
    const row = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (!row) throw new NotFoundException('Page not found');

    const currentSections = (row.sections ?? {}) as Record<string, unknown>;
    const patchedSections = data.sections
      ? mergeContent(currentSections, data.sections)
      : currentSections;

    await this.prisma.contentPage.update({
      where: { slug },
      data: {
        title: data.title ?? row.title,
        published: data.published ?? row.published,
        sections: patchedSections as object,
      },
    });

    return this.getPage(slug, { includeUnpublished: true });
  }

  async createPage(data: { slug: string; title: string; sections?: Record<string, unknown> }) {
    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!slug) throw new NotFoundException('Invalid slug');

    const existing = await this.prisma.contentPage.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException('Page already exists');

    await this.prisma.contentPage.create({
      data: {
        slug,
        title: data.title.trim(),
        sections: (data.sections ?? {}) as object,
        published: false,
      },
    });

    return this.getPage(slug, { includeUnpublished: true });
  }
}
