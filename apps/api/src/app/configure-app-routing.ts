import type { INestApplication } from '@nestjs/common';

import { VersioningType } from '@nestjs/common';

export const configureAppRouting = (app: INestApplication): void => {
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
};
