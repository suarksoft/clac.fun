import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { TokensV2Service } from './tokens-v2.service';

@Controller('v2/tokens')
export class TokensV2Controller {
  constructor(private readonly service: TokensV2Service) {}

  @Get()
  list(
    @Query('filter') filter?: 'live' | 'dying' | 'dead' | 'new' | 'hot',
    @Query('limit') limit?: string,
  ) {
    const lim = Math.min(Math.max(Number(limit ?? 50), 1), 100);
    return this.service.list(filter, lim);
  }

  @Get(':idOrSlug')
  async get(@Param('idOrSlug') idOrSlug: string) {
    const token = await this.service.byAddressOrSlug(idOrSlug);
    if (!token) throw new NotFoundException(`Token not found: ${idOrSlug}`);
    return token;
  }

  @Get(':address/holders')
  holders(@Param('address') address: string) {
    return this.service.holders(address);
  }

  @Get(':address/trades')
  trades(@Param('address') address: string, @Query('limit') limit?: string) {
    const lim = Math.min(Math.max(Number(limit ?? 50), 1), 200);
    return this.service.trades(address, lim);
  }

  @Get(':address/lottery')
  lottery(@Param('address') address: string) {
    return this.service.lottery(address);
  }

  @Get(':address/claims')
  claims(@Param('address') address: string) {
    return this.service.claims(address);
  }
}
