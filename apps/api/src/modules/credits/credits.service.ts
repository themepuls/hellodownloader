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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.credits < amount) {
      throw new BadRequestException(`Insufficient credits. Need ${amount}, have ${user?.credits ?? 0}`);
    }

    const balance = user.credits - amount;
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { credits: balance },
      }),
      this.prisma.creditLog.create({
        data: { userId, amount: -amount, reason, balance },
      }),
    ]);

    return { credits: balance };
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
