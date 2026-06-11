import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from '../shared/dtos/error-response.dto';

/*
 * Every operationId follows the architecture's `<resource><Action>` camelCase rule
 * (Naming Patterns): `HealthController` + `check` → `healthCheck`,
 * `TransactionsController` + `create` → `transactionsCreate`. They become the
 * generated client's method names (D8), so the composition is load-bearing.
 */
const buildOperationId = (controllerKey: string, methodKey: string): string => {
  const resource = controllerKey.replace(/Controller$/u, '');
  const lowerResource = resource.charAt(0).toLowerCase() + resource.slice(1);
  const upperMethod = methodKey.charAt(0).toUpperCase() + methodKey.slice(1);
  return `${lowerResource}${upperMethod}`;
};

/**
 * Builds the OpenAPI document shared by Swagger UI (dev) and the build-time
 * `openapi.json` emission (D8).
 */
export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('supertool API')
    .setDescription('Single API for all supertool tool apps')
    .setVersion('1.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: buildOperationId,
    /*
     * The error envelope is shaped by the global exception filter, not returned
     * from controllers — register it explicitly so it is exposed through OpenAPI (D7).
     */
    extraModels: [ErrorResponseDto],
  });
};
