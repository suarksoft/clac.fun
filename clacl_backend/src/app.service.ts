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
}
