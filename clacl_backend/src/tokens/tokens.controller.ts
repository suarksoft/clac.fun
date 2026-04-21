import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TokensService } from './tokens.service';
import type { TokenFilter } from './tokens.service';

const validFilters: TokenFilter[] = ['live', 'dying', 'dead', 'new', 'hot'];

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  getAllTokens(@Query('filter') filter = 'live') {
    const safeFilter: TokenFilter = validFilters.includes(filter as TokenFilter)
      ? (filter as TokenFilter)
      : 'live';
    return this.tokensService.getAllTokens(safeFilter);
  }

  @Get('trending')
  getTrendingTokens() {
    return this.tokensService.getTrendingTokens();
  }

  @Get('dying')
  getDyingTokens() {
    return this.tokensService.getDyingTokens();
  }

  @Get(':id')
  getTokenById(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.getTokenById(id);
  }

  @Get(':id/trades')
  getTokenTrades(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.tokensService.getTradesByToken(id, Number(page), Number(limit));
  }

  @Get(':id/holders')
  getTokenHolders(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.getHoldersByToken(id);
  }

  @Get(':id/lottery')
  getTokenLottery(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.getLotteryByToken(id);
  }
}
