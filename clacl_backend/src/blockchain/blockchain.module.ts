import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [TokensModule],
  providers: [BlockchainService, PrismaService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
