import type { INestApplication } from '@nestjs/common';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';

export const configureAppRouting = (app: INestApplication): void => {
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
};
