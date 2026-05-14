import { Controller, Get, Param, Query } from '@nestjs/common';
import { TokensV2Service } from './tokens-v2.service';

@Controller('v2')
export class TradesV2Controller {
  constructor(private readonly service: TokensV2Service) {}

  @Get('trades/recent')
  recent(@Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit ?? 20), 1), 100);
    return this.service.recentTrades(lim);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.service.leaderboard(lim);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get('portfolio/:address')
  portfolio(@Param('address') address: string) {
    return this.service.portfolio(address);
  }
}
