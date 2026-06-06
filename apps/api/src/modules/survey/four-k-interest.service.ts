import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FourKInterestService {
  constructor(private prisma: PrismaService) {}

  async getResponse(userId?: string | null, visitorId?: string | null) {
    if (userId) {
      const row = await this.prisma.fourKInterestSurvey.findUnique({ where: { userId } });
      if (row) return { voted: true as const, interested: row.interested };
    }
    if (visitorId?.trim()) {
      const row = await this.prisma.fourKInterestSurvey.findUnique({
        where: { visitorId: visitorId.trim() },
      });
      if (row) return { voted: true as const, interested: row.interested };
    }
    return { voted: false as const };
  }

  async submit(interested: boolean, userId?: string | null, visitorId?: string | null) {
    if (userId) {
      return this.prisma.fourKInterestSurvey.upsert({
        where: { userId },
        create: {
          userId,
          interested,
          visitorId: visitorId?.trim() || null,
        },
        update: { interested },
      });
    }

    const vid = visitorId?.trim();
    if (!vid) {
      throw new BadRequestException('visitorId is required for guest responses');
    }

    return this.prisma.fourKInterestSurvey.upsert({
      where: { visitorId: vid },
      create: { visitorId: vid, interested },
      update: { interested },
    });
  }

  async getCounts() {
    const [yes, no] = await Promise.all([
      this.prisma.fourKInterestSurvey.count({ where: { interested: true } }),
      this.prisma.fourKInterestSurvey.count({ where: { interested: false } }),
    ]);
    return { yes, no, total: yes + no };
  }
}
