import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { TokenListQueryDto } from './dto/token-list-query.dto';

@Controller('tokens')
export class TokensController {
  constructor(private readonly tokensService: TokensService) {}

  @Get()
  getAllTokens(@Query() query: TokenListQueryDto) {
    return this.tokensService.getAllTokens(query.filter, query.limit);
  }

  @Get('trending')
  getTrendingTokens() {
    return this.tokensService.getTrendingTokens();
  }

  @Get('dying')
  getDyingTokens() {
    return this.tokensService.getDyingTokens();
  }

  @Get(':idOrSlug')
  getToken(@Param('idOrSlug') idOrSlug: string) {
    if (idOrSlug.startsWith('0x')) {
      return this.tokensService.getTokenBySlug(idOrSlug);
    }
    return this.tokensService.getTokenById(parseInt(idOrSlug, 10));
  }

  @Get(':id/trades')
  getTokenTrades(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.tokensService.getTradesByToken(id, query.page, query.limit);
  }

  @Get(':id/holders')
  getTokenHolders(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.getHoldersByToken(id);
  }

  @Get(':id/lottery')
  getTokenLottery(@Param('id', ParseIntPipe) id: number) {
    return this.tokensService.getLotteryByToken(id);
  }

  @Patch(':id/socials')
  updateSocials(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { website?: string; twitter?: string; telegram?: string; description?: string },
  ) {
    return this.tokensService.updateTokenSocials(id, body);
  }
}
