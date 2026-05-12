import { Controller, Get, Query } from '@nestjs/common';
import { TokensV2Service } from './tokens-v2.service';

@Controller('v2/trades')
export class TradesV2Controller {
  constructor(private readonly service: TokensV2Service) {}

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 100);
    return this.service.recentTrades(lim);
  }
}
