import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

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

  async getCandles(
    tokenId: number,
    interval: string,
    limit: number,
  ): Promise<CandleData[]> {
    const intervalSeconds = INTERVAL_SECONDS[interval] ?? 60;
    const fromTime = new Date(Date.now() - intervalSeconds * limit * 1000);

    const trades = await this.prisma.trade.findMany({
      where: {
        tokenId,
        timestamp: { gte: fromTime },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        newPrice: true,
        monAmount: true,
      },
    });

    if (trades.length === 0) return [];

    const candles = new Map<number, CandleData>();

    for (const trade of trades) {
      const tradeTime = Math.floor(trade.timestamp.getTime() / 1000);
      const candleTime =
        Math.floor(tradeTime / intervalSeconds) * intervalSeconds;

      const price = Number(ethers.formatEther(BigInt(trade.newPrice)));
      const volume = Number(ethers.formatEther(BigInt(trade.monAmount)));

      if (!Number.isFinite(price) || price <= 0) continue;

      const existing = candles.get(candleTime);
      if (existing) {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.close = price;
        existing.volume += volume;
      } else {
        candles.set(candleTime, {
          time: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume,
        });
      }
    }

    const sorted = Array.from(candles.values()).sort(
      (a, b) => a.time - b.time,
    );

    // Fill gaps with flat candles (previous close) so chart has no discontinuities
    const filled: CandleData[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        let prevTime = filled[filled.length - 1].time;
        const prevClose = filled[filled.length - 1].close;
        while (prevTime + intervalSeconds < sorted[i].time) {
          prevTime += intervalSeconds;
          filled.push({
            time: prevTime,
            open: prevClose,
            high: prevClose,
            low: prevClose,
            close: prevClose,
            volume: 0,
          });
        }
      }
      filled.push(sorted[i]);
    }

    return filled.slice(-limit);
  }
}
