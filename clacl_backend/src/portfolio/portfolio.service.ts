import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(address: string) {
    const holdings = await this.prisma.holder.findMany({
      where: { address },
      include: { token: true },
    });

    const trades = await this.prisma.trade.findMany({
      where: { trader: address },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: {
        token: { select: { name: true, symbol: true } },
      },
    });

    const claims = await this.prisma.claim.findMany({
      where: { holder: address },
      orderBy: { timestamp: 'desc' },
    });

    const lotteryWins = await this.prisma.lotteryWin.findMany({
      where: { winner: address },
      orderBy: { timestamp: 'desc' },
    });

    return { holdings, trades, claims, lotteryWins };
  }

  async getClaims(address: string) {
    return this.prisma.claim.findMany({
      where: { holder: address },
      orderBy: { timestamp: 'desc' },
      include: { token: true },
    });
  }
}
