import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { activeConfig } from './config/monad.config';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'clac-backend',
      now: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ready',
      database: 'ok',
      chainId: activeConfig.chainId,
      factoryAddress: activeConfig.factoryAddress,
    };
  }

  async getStats() {
    // V2-only stats. V1 tables are no longer indexed.
    const now = Math.floor(Date.now() / 1000);
    const [totalTrades, tokens] = await Promise.all([
      this.prisma.tradeV2.count(),
      this.prisma.tokenV2.findMany({
        select: { deathFinalized: true, deathTime: true, volume24h: true },
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
}
