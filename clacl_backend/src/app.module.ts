import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { BlockchainModule } from './blockchain/blockchain.module';
import { TokensModule } from './tokens/tokens.module';
import { TradesModule } from './trades/trades.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { UploadsController } from './uploads.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_MS ?? 60000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 120),
      },
    ]),
    BlockchainModule,
    TokensModule,
    TradesModule,
    LeaderboardModule,
    PortfolioModule,
  ],
  controllers: [AppController, UploadsController, AdminController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
