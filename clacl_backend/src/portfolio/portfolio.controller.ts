import { Controller, Get, Param } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':address')
  getPortfolio(@Param('address') address: string) {
    return this.portfolioService.getPortfolio(address.toLowerCase());
  }

  @Get(':address/claims')
  getClaims(@Param('address') address: string) {
    return this.portfolioService.getClaims(address.toLowerCase());
  }
}
