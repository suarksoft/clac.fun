import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { join } from 'path';
import { mkdirSync } from 'fs';
import express from 'express';
import { AppModule } from './app.module';

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
  app.enableCors({ origin: '*' });
  app.use('/uploads', express.static(uploadsDir));
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
  console.log('clac.fun backend running on http://localhost:3001');
}
bootstrap();
