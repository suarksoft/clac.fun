import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TokenFilter = 'live' | 'dying' | 'dead' | 'new' | 'hot';

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTokens(filter: TokenFilter = 'live', limit = 50) {
    const now = Math.floor(Date.now() / 1000);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    switch (filter) {
      case 'live':
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { volume24h: 'desc' },
          take: safeLimit,
        });

      case 'dying': {
        const tokens = await this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { createdAt: 'asc' },
          take: safeLimit * 3,
        });
        return tokens
          .filter((token) => token.createdAt + token.duration - now < 3600)
          .slice(0, safeLimit);
      }

      case 'dead':
        return this.prisma.token.findMany({
          where: { dead: true },
          orderBy: { indexedAt: 'desc' },
          take: safeLimit,
        });

      case 'new':
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { createdAt: 'desc' },
          take: safeLimit,
        });

      case 'hot':
      default:
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { volume24h: 'desc' },
          take: safeLimit,
        });
    }
  }

  async getTokenById(id: number) {
    return this.prisma.token.findUnique({
      where: { id },
      include: {
        trades: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async getTokenBySlug(slug: string) {
    return this.prisma.token.findUnique({
      where: { slug },
      include: {
        trades: {
          take: 50,
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async getTradesByToken(tokenId: number, page = 1, limit = 50) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.prisma.trade.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }

  async getHoldersByToken(tokenId: number) {
    return this.prisma.holder.findMany({
      where: { tokenId },
      orderBy: { balance: 'desc' },
      take: 250,
    });
  }

  async getLotteryByToken(tokenId: number) {
    return this.prisma.lotteryWin.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async getTrendingTokens() {
    return this.prisma.token.findMany({
      where: { dead: false },
      orderBy: [{ volume24h: 'desc' }, { marketCap: 'desc' }],
      take: 20,
    });
  }

  async getDyingTokens() {
    return this.getAllTokens('dying', 50);
  }
}
