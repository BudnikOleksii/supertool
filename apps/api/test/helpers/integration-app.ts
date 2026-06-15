import type { INestApplication } from '@nestjs/common';

import { Test } from '@nestjs/testing';

export const configureTestEnvironment = (databaseUrl: string): void => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.BETTER_AUTH_SECRET = 'integration-test-secret';
  process.env.AUTH_RATE_LIMIT_DISABLED = 'true';
};

export const bootIntegrationApp = async (): Promise<{
  app: INestApplication;
  baseUrl: string;
}> => {
  const { AppModule } = await import('../../src/app/app.module.js');
  const { configureAppRouting } = await import('../../src/app/configure-app-routing.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  configureAppRouting(app);
  await app.listen(0);
  const baseUrl = await app.getUrl();

  return { app, baseUrl };
};
