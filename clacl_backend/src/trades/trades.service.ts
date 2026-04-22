import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async getRecentTrades(limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.prisma.trade.findMany({
      orderBy: { timestamp: 'desc' },
      take: safeLimit,
      include: {
        token: {
          select: { name: true, symbol: true },
        },
      },
    });
  }

  async getWinners(limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.prisma.trade.findMany({
      where: { isBuy: false },
      orderBy: { monAmount: 'desc' },
      take: safeLimit,
      include: {
        token: {
          select: { name: true, symbol: true },
        },
      },
    });
  }
}
