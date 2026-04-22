import { Controller, Get, Param } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { EthAddressPipe } from '../common/pipes/eth-address.pipe';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':address')
  getPortfolio(@Param('address', EthAddressPipe) address: string) {
    return this.portfolioService.getPortfolio(address);
  }

  @Get(':address/claims')
  getClaims(@Param('address', EthAddressPipe) address: string) {
    return this.portfolioService.getClaims(address);
  }
}
