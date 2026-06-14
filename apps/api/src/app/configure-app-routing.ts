import type { INestApplication } from '@nestjs/common';

import { ValidationPipe, VersioningType } from '@nestjs/common';

export const configureAppRouting = (app: INestApplication): void => {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
};
