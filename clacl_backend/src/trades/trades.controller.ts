import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TradesService } from './trades.service';
import { LimitQueryDto } from '../common/dto/limit-query.dto';

const VALID_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get('recent')
  getRecentTrades(@Query() query: LimitQueryDto) {
    return this.tradesService.getRecentTrades(query.limit);
  }

  @Get('winners')
  getWinners(@Query() query: LimitQueryDto) {
    return this.tradesService.getWinners(query.limit);
  }

  @Get('candles/:tokenId')
  getCandles(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @Query('interval') interval = '1m',
    @Query('limit') limitParam = '200',
  ) {
    const safeInterval = (VALID_INTERVALS as readonly string[]).includes(
      interval,
    )
      ? interval
      : '1m';
    const safeLimit = Math.min(Math.max(parseInt(limitParam) || 200, 1), 1000);
    return this.tradesService.getCandles(tokenId, safeInterval, safeLimit);
  }
}
