import {
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { unlink } from 'fs/promises';
import { basename } from 'path';
import { AdminPasswordGuard } from './common/guards/admin-password.guard';

@Controller('admin')
@UseGuards(AdminPasswordGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get('v2/tokens')
  async getV2Tokens(@Query('limit') limitParam?: string) {
    const parsed = Number(limitParam ?? 100);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;
    return this.prisma.tokenV2.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        address: true,
        name: true,
        symbol: true,
        imageURI: true,
        deathFinalized: true,
        createdAt: true,
      },
    });
  }

  @Delete('v2/tokens/:address')
  async deleteV2Token(@Param('address') address: string) {
    const lower = address.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(lower)) throw new NotFoundException('Invalid address');
    const token = await this.prisma.tokenV2.findUnique({
      where: { address: lower },
      select: { address: true, imageURI: true },
    });
    if (!token) throw new NotFoundException('Token not found');

    try {
      await this.prisma.$transaction([
        this.prisma.tradeV2.deleteMany({ where: { tokenAddress: lower } }),
        this.prisma.holderV2.deleteMany({ where: { tokenAddress: lower } }),
        this.prisma.lotteryWinV2.deleteMany({ where: { tokenAddress: lower } }),
        this.prisma.claimV2.deleteMany({ where: { tokenAddress: lower } }),
        this.prisma.tokenV2.delete({ where: { address: lower } }),
      ]);
    } catch (err) {
      this.logger.error(`Failed to delete V2 token ${lower}`, err instanceof Error ? err.stack : String(err));
      throw err;
    }

    const imageURI = (token.imageURI ?? '').trim();
    if (imageURI.includes('/uploads/')) {
      const filename = basename(imageURI);
      if (filename) {
        try {
          await unlink(`uploads/${filename}`);
        } catch (e) {
          this.logger.warn(`Failed to unlink upload ${filename}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    this.logger.log(`Deleted V2 token ${lower}`);
    return { ok: true, deletedAddress: lower };
  }
}
