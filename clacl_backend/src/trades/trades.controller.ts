import { Controller, Get, Query } from '@nestjs/common';
import { TradesService } from './trades.service';
import { LimitQueryDto } from '../common/dto/limit-query.dto';

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
}
