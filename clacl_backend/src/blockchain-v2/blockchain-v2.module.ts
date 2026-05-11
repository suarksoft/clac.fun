import { Module } from '@nestjs/common';
import { BlockchainV2Service } from './blockchain-v2.service';
import { TokensV2Gateway } from './tokens-v2.gateway';
import { TokensV2Service } from './tokens-v2.service';
import { TokensV2Controller } from './tokens-v2.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TokensV2Controller],
  providers: [
    BlockchainV2Service,
    TokensV2Gateway,
    TokensV2Service,
    PrismaService,
  ],
  exports: [BlockchainV2Service, TokensV2Gateway, TokensV2Service],
})
export class BlockchainV2Module {}
