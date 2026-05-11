import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from './prisma/prisma.service';
import { activeConfig } from './config/monad.config';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    // DB ping
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      checks.db = { ok: true };
    } catch (err) {
      checks.db = {
        ok: false,
        detail: err instanceof Error ? err.message : 'unknown',
      };
    }

    // RPC head block
    try {
      const provider = new ethers.JsonRpcProvider(activeConfig.rpcUrl);
      const head = await provider.getBlockNumber();
      checks.rpc = { ok: head > 0, detail: `block ${head}` };
    } catch (err) {
      checks.rpc = {
        ok: false,
        detail: err instanceof Error ? err.message : 'unknown',
      };
    }

    const allOk = Object.values(checks).every((c) => c.ok);
    if (!allOk) {
      throw new HttpException(
        { status: 'degraded', checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      status: 'ok',
      chainId: activeConfig.chainId,
      factory: activeConfig.factoryAddress || null,
      checks,
    };
  }
}
