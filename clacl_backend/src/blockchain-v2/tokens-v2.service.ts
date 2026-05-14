import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokensV2Service {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: 'live' | 'dying' | 'dead' | 'new' | 'hot', limit = 50) {
    const now = Math.floor(Date.now() / 1000);
    const where: any = {};
    if (filter === 'live') {
      where.deathFinalized = false;
      where.deathTime = { gt: now };
    } else if (filter === 'dying') {
      where.deathFinalized = false;
      where.deathTime = { gt: now, lt: now + 3600 };
    } else if (filter === 'dead') {
      where.deathFinalized = true;
    } else if (filter === 'new') {
      where.createdAt = { gt: now - 3600 };
    }

    const orderBy: any =
      filter === 'hot'
        ? { volume24h: 'desc' }
        : filter === 'new'
          ? { createdAt: 'desc' }
          : { createdAt: 'desc' };

    return this.prisma.tokenV2.findMany({ where, orderBy, take: limit });
  }

  async byAddressOrSlug(idOrSlug: string) {
    const lower = idOrSlug.toLowerCase();
    const isAddress = lower.startsWith('0x') && lower.length === 42;
    const token = isAddress
      ? await this.prisma.tokenV2.findUnique({
          where: { address: lower },
          include: { trades: { orderBy: { timestamp: 'desc' }, take: 50 } },
        })
      : await this.prisma.tokenV2.findUnique({
          where: { slug: idOrSlug },
          include: { trades: { orderBy: { timestamp: 'desc' }, take: 50 } },
        });
    return token;
  }

  async holders(address: string) {
    return this.prisma.holderV2.findMany({
      where: { tokenAddress: address.toLowerCase() },
      orderBy: { balance: 'desc' },
      take: 250,
    });
  }

  async trades(address: string, limit = 50) {
    return this.prisma.tradeV2.findMany({
      where: { tokenAddress: address.toLowerCase() },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async lottery(address: string) {
    return this.prisma.lotteryWinV2.findMany({
      where: { tokenAddress: address.toLowerCase() },
      orderBy: { timestamp: 'desc' },
    });
  }

  async claims(address: string) {
    return this.prisma.claimV2.findMany({
      where: { tokenAddress: address.toLowerCase() },
      orderBy: { timestamp: 'desc' },
    });
  }

  async recentTrades(limit = 20) {
    return this.prisma.tradeV2.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { token: { select: { symbol: true, imageURI: true, name: true } } },
    });
  }

  async leaderboard(limit = 50) {
    return this.prisma.tokenV2.findMany({
      orderBy: { marketCap: 'desc' },
      take: limit,
    });
  }

  async stats() {
    const now = Math.floor(Date.now() / 1000);
    const [totalTrades, tokens] = await Promise.all([
      this.prisma.tradeV2.count(),
      this.prisma.tokenV2.findMany({
        select: { deathFinalized: true, createdAt: true, deathTime: true, volume24h: true },
      }),
    ]);

    let totalVolume = 0;
    let liveCount = 0;
    let clacdCount = 0;
    for (const t of tokens) {
      totalVolume += Number(t.volume24h ?? 0);
      if (t.deathFinalized) clacdCount++;
      else if (t.deathTime > now) liveCount++;
    }

    return {
      totalTrades,
      totalVolume: totalVolume.toFixed(1),
      liveCount,
      clacdCount,
    };
  }

  async portfolio(holderAddress: string) {
    const lower = holderAddress.toLowerCase();
    const holdings = await this.prisma.holderV2.findMany({
      where: { address: lower, balance: { not: '0' } },
      include: {
        token: {
          select: {
            address: true,
            name: true,
            symbol: true,
            imageURI: true,
            currentPrice: true,
            createdAt: true,
            duration: true,
            deathFinalized: true,
          },
        },
      },
    });

    return holdings.map((h) => {
      let valueMon = '0';
      try {
        const balance = BigInt(h.balance || '0');
        const price = BigInt(h.token.currentPrice || '0');
        // Both in wei; price = MON per token (with 18 decimals). Value = balance * price / 1e18.
        const value = (balance * price) / BigInt(10) ** BigInt(18);
        valueMon = value.toString();
      } catch {
        // ignore conversion failures, keep "0"
      }

      return {
        tokenAddress: h.token.address,
        tokenName: h.token.name,
        tokenSymbol: h.token.symbol,
        imageURI: h.token.imageURI,
        balance: h.balance,
        currentPrice: h.token.currentPrice,
        valueMon,
        deathFinalized: h.token.deathFinalized,
        createdAt: h.token.createdAt,
        duration: h.token.duration,
        claimableMon: '0',
      };
    });
  }

  async updateSocials(
    address: string,
    data: { website?: string; twitter?: string; telegram?: string; description?: string },
  ) {
    const lower = address.toLowerCase();
    return this.prisma.tokenV2.update({
      where: { address: lower },
      data: {
        website: data.website ?? undefined,
        twitter: data.twitter ?? undefined,
        telegram: data.telegram ?? undefined,
        description: data.description ?? undefined,
      },
    });
  }
}
