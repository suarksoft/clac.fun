import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard() {
    return this.prisma.token.findMany({
      orderBy: { marketCap: 'desc' },
      take: 50,
    });
  }

  async getTopTraders() {
    const sells = await this.prisma.trade.groupBy({
      by: ['trader'],
      where: { isBuy: false },
      _count: { trader: true },
      orderBy: { _count: { trader: 'desc' } },
      take: 50,
    });

    return sells.map((item) => ({
      trader: item.trader,
      sellCount: item._count.trader,
    }));
  }
}
