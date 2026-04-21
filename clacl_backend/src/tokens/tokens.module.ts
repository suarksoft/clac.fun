import { Module } from '@nestjs/common';
import { TokensController } from './tokens.controller';
import { TokensGateway } from './tokens.gateway';
import { TokensService } from './tokens.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TokensController],
  providers: [TokensService, TokensGateway, PrismaService],
  exports: [TokensService, TokensGateway],
})
export class TokensModule {}
