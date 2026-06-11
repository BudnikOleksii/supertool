import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppModule } from './app/app.module';
import { buildOpenApiDocument } from './app/openapi';

const JSON_INDENT = 2;
const EXIT_FAILURE = 1;

/**
 * Build-time OpenAPI emission (D8): bootstraps the app without listening and
 * writes `apps/api/openapi.json` for Story 1.3's client-generation turbo task.
 */
const emitOpenApi = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const document = buildOpenApiDocument(app);
  const outputPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, `${JSON.stringify(document, null, JSON_INDENT)}\n`);

  await app.close();
  process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
};

emitOpenApi().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT_FAILURE);
});
