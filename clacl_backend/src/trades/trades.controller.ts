import { Controller, Get, Query } from '@nestjs/common';
import { TradesService } from './trades.service';

@Controller('trades')
export class TradesController {
  constructor(private readonly tradesService: TradesService) {}

  @Get('recent')
  getRecentTrades(@Query('limit') limit = '20') {
    return this.tradesService.getRecentTrades(Number(limit));
  }

  @Get('winners')
  getWinners(@Query('limit') limit = '10') {
    return this.tradesService.getWinners(Number(limit));
  }
}
