import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    });
    return { credits: user?.credits ?? 0 };
  }

  async deduct(userId: string, amount: number, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, credits: { gte: amount } },
        data: { credits: { decrement: amount } },
      });

      if (updated.count === 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });
        throw new BadRequestException(
          `Insufficient credits. Need ${amount}, have ${user?.credits ?? 0}`,
        );
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      const balance = user!.credits;

      await tx.creditLog.create({
        data: { userId, amount: -amount, reason, balance },
      });

      return { credits: balance };
    });
  }

  async add(userId: string, amount: number, reason: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: amount } },
    });

    await this.prisma.creditLog.create({
      data: {
        userId,
        amount,
        reason,
        balance: user.credits,
      },
    });

    return { credits: user.credits };
  }

  async getHistory(userId: string) {
    return this.prisma.creditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
