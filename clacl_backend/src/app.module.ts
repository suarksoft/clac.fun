import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { BlockchainModule } from './blockchain/blockchain.module';
import { TokensModule } from './tokens/tokens.module';
import { TradesModule } from './trades/trades.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PortfolioModule } from './portfolio/portfolio.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    BlockchainModule,
    TokensModule,
    TradesModule,
    LeaderboardModule,
    PortfolioModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
