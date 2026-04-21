import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TokenFilter = 'live' | 'dying' | 'dead' | 'new' | 'hot';

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllTokens(filter: TokenFilter = 'live') {
    const now = Math.floor(Date.now() / 1000);

    switch (filter) {
      case 'live':
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { volume24h: 'desc' },
        });

      case 'dying': {
        const tokens = await this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { createdAt: 'asc' },
        });
        return tokens.filter((token) => token.createdAt + token.duration - now < 3600);
      }

      case 'dead':
        return this.prisma.token.findMany({
          where: { dead: true },
          orderBy: { indexedAt: 'desc' },
        });

      case 'new':
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { createdAt: 'desc' },
        });

      case 'hot':
      default:
        return this.prisma.token.findMany({
          where: { dead: false },
          orderBy: { volume24h: 'desc' },
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

  async getTradesByToken(tokenId: number, page = 1, limit = 50) {
    return this.prisma.trade.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getHoldersByToken(tokenId: number) {
    return this.prisma.holder.findMany({
      where: { tokenId },
      orderBy: { balance: 'desc' },
    });
  }

  async getLotteryByToken(tokenId: number) {
    return this.prisma.lotteryWin.findMany({
      where: { tokenId },
      orderBy: { timestamp: 'desc' },
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
    return this.getAllTokens('dying');
  }
}
