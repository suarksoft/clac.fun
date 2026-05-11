import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { BlockchainV2Module } from './blockchain-v2/blockchain-v2.module';
import { TokensModule } from './tokens/tokens.module';
import { TradesModule } from './trades/trades.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { AdminController } from './admin.controller';
import { HealthController } from './health.controller';
import { AdminPasswordGuard } from './common/guards/admin-password.guard';
import { UploadModule } from './upload/upload.module';

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
    BlockchainV2Module,
    TokensModule,
    TradesModule,
    LeaderboardModule,
    PortfolioModule,
    UploadModule,
  ],
  controllers: [AppController, AdminController, HealthController],
  providers: [
    AppService,
    PrismaService,
    AdminPasswordGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [PrismaService],
})
export class AppModule {}
