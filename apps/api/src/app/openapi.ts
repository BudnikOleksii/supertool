import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from '../shared/dtos/error-response.dto';

/**
 * Builds the OpenAPI document shared by Swagger UI (dev) and the build-time
 * `openapi.json` emission (D8). operationIds are the bare method names so the
 * generated client gets `<resource><Action>` camelCase methods (architecture: Naming Patterns).
 */
export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('supertool API')
    .setDescription('Single API for all supertool tool apps')
    .setVersion('1.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    /*
     * The error envelope is shaped by the global exception filter, not returned
     * from controllers — register it explicitly so it is exposed through OpenAPI (D7).
     */
    extraModels: [ErrorResponseDto],
  });
};
