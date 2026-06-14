import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { join } from 'node:path';

import { AppModule } from './app/app.module';
import { configureAppRouting } from './app/configure-app-routing';
import { parseEnv } from './app/env.schema';
import { buildOpenApiDocument } from './app/openapi';
import { prepareDatabase } from './database/prepare-database';

const EXIT_FAILURE = 1;

const resolveMigrationsFolder = (): string => join(__dirname, 'database', 'migrations');

const bootstrap = async (): Promise<void> => {
  const env = parseEnv();

  await prepareDatabase({
    databaseUrl: env.DATABASE_URL,
    migrationsFolder: resolveMigrationsFolder(),
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  app.useLogger(app.get(Logger));
  configureAppRouting(app);
  app.enableShutdownHooks();

  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  }

  await app.listen(env.PORT);
};

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT_FAILURE);
});
