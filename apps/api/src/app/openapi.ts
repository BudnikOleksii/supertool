import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from '../shared/dtos/error-response.dto';

const buildResourceActionOperationId = (controllerKey: string, methodKey: string): string => {
  const resource = controllerKey.replace(/Controller$/u, '');
  const lowerResource = resource.charAt(0).toLowerCase() + resource.slice(1);
  const upperMethod = methodKey.charAt(0).toUpperCase() + methodKey.slice(1);
  return `${lowerResource}${upperMethod}`;
};

export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject => {
  const config = new DocumentBuilder()
    .setTitle('supertool API')
    .setDescription('Single API for all supertool tool apps')
    .setVersion('1.0')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: buildResourceActionOperationId,
    extraModels: [ErrorResponseDto],
  });
};
