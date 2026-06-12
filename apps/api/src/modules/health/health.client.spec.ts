import type { INestApplication } from '@nestjs/common';

import { Test } from '@nestjs/testing';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { createClient, createConfig } from '@supertool/shared/generated/client/index';
import { HealthApiService } from '@supertool/shared/generated/sdk.gen';
import type { HealthResponseDto } from '@supertool/shared/generated/types.gen';

import { AppModule } from '../../app/app.module';
import { configureAppRouting } from '../../app/configure-app-routing';

const HTTP_OK = 200;

const bootApp = async (): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureAppRouting(app);
  await app.listen(0);
  return app;
};

const fetchHealthReport = async (app: INestApplication) => {
  const client = createClient(createConfig({ baseUrl: await app.getUrl() }));
  return HealthApiService.healthCheck({ client });
};

describe('health endpoint through the generated client', () => {
  it('returns a typed health report end-to-end', async () => {
    const app = await bootApp();

    try {
      const { data, response } = await fetchHealthReport(app);

      expect(response?.status).toBe(HTTP_OK);
      expectTypeOf(data).toEqualTypeOf<HealthResponseDto | undefined>();
      expectTypeOf(data?.status).toEqualTypeOf<'ok' | 'degraded' | undefined>();
      expectTypeOf(data?.database).toEqualTypeOf<'up' | 'down' | undefined>();
      expect(['ok', 'degraded']).toContain(data?.status);
      expect(['up', 'down']).toContain(data?.database);
    } finally {
      await app.close();
    }
  });
});
