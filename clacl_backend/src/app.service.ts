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
      contractAddress: activeConfig.contractAddress,
    };
  }

  async getStats() {
    const now = Math.floor(Date.now() / 1000);
    const [totalTrades, tokens] = await Promise.all([
      this.prisma.trade.count(),
      this.prisma.token.findMany({
        select: { dead: true, createdAt: true, duration: true, volume24h: true },
      }),
    ]);

    let totalVolume = 0;
    let liveCount = 0;
    let clacdCount = 0;

    for (const t of tokens) {
      totalVolume += t.volume24h;
      if (t.dead) {
        clacdCount++;
      } else if (t.createdAt + t.duration > now) {
        liveCount++;
      }
    }

    return {
      totalTrades,
      totalVolume: totalVolume.toFixed(1),
      liveCount,
      clacdCount,
    };
  }
}
