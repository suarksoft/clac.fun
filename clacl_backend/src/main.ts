// Load .env before any other import so module-level process.env reads
// (e.g. config/monad.config.ts) see the values during local dev.
// On Render the env vars are set by the platform, so dotenv is a no-op there.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import express from 'express';
import { AppModule } from './app.module';

/** NestJS bootstrap — clac.fun API. */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

  app.use(
    helmet({
      // Upload gorselleri frontend tarafinda farkli origin'den de render edilebilsin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const allowedOrigins = (process.env.CORS_ORIGINS || 'https://clac.fun')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });
  app.use('/uploads', express.static(uploadsDir));
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
  console.log('clac.fun backend running on http://localhost:3001');
}
bootstrap();
