import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
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
  constructor(private readonly prisma: PrismaService) {}

  @Get('tokens')
  async getTokens(
    @Query('limit') limitParam?: string,
  ) {
    const parsed = Number(limitParam ?? 100);
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100;

    return this.prisma.token.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        symbol: true,
        imageURI: true,
        dead: true,
        createdAt: true,
      },
    });
  }

  @Delete('tokens/:id')
  async deleteToken(@Param('id', ParseIntPipe) id: number) {
    const token = await this.prisma.token.findUnique({
      where: { id },
      select: { id: true, imageURI: true },
    });
    if (!token) {
      throw new NotFoundException('Token not found');
    }

    await this.prisma.$transaction([
      this.prisma.trade.deleteMany({ where: { tokenId: id } }),
      this.prisma.holder.deleteMany({ where: { tokenId: id } }),
      this.prisma.lotteryWin.deleteMany({ where: { tokenId: id } }),
      this.prisma.claim.deleteMany({ where: { tokenId: id } }),
      this.prisma.token.delete({ where: { id } }),
    ]);

    const imageURI = (token.imageURI ?? '').trim();
    if (imageURI.includes('/uploads/')) {
      const filename = basename(imageURI);
      if (filename) {
        try {
          await unlink(`uploads/${filename}`);
        } catch {
          // Best effort cleanup only.
        }
      }
    }

    return { ok: true, deletedTokenId: id };
  }
}
