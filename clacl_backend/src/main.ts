import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getAllowedOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = getAllowedOrigins();

  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({ origin: allowedOrigins });
  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
  console.log('clac.fun backend running on http://localhost:3001');
}
bootstrap();
