import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggerService } from './utils/logger';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load root .env for monorepo dev
const rootEnv = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: rootEnv });

const monorepoRoot = path.resolve(__dirname, '../../..');

if (process.env.DATABASE_URL?.startsWith('file:')) {
  const filePath = process.env.DATABASE_URL.replace('file:', '').replace(/^\.\//, '');
  if (!path.isAbsolute(filePath) && (filePath.startsWith('packages/') || filePath.includes('/packages/'))) {
    process.env.DATABASE_URL = `file:${path.join(monorepoRoot, filePath)}`;
  }
}
if (process.env.STORAGE_PATH && !path.isAbsolute(process.env.STORAGE_PATH)) {
  process.env.STORAGE_PATH = path.join(monorepoRoot, process.env.STORAGE_PATH.replace(/^\.\//, ''));
}

import { validateEnv } from '@hellodownloader/config';

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  const logger = app.get(LoggerService);

  app.useLogger(logger);
  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins?.length ? corsOrigins : defaultOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  logger.log(`HelloDownloader API running on http://localhost:${port}/api/v1`);
}

bootstrap();
