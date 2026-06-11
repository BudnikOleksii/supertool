import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AppModule } from './app/app.module';
import { configureAppRouting } from './app/configure-app-routing';
import { buildOpenApiDocument } from './app/openapi';

const JSON_INDENT = 2;
const EXIT_FAILURE = 1;

const emitOpenApi = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureAppRouting(app);

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
