import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import { buildTestUser, createAuthClient } from '../helpers/auth-client.js';
import { createHttpClient } from '../helpers/http-client.js';
import { bootIntegrationApp, configureTestEnvironment } from '../helpers/integration-app.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  runMigrations,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

interface UserBody {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  defaultCurrency: string | null;
  onboardingCompleted: boolean;
}

interface ErrorBody {
  code: string;
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { readJson, getJson, patchJson } = httpClient;
const { registerAndSignIn } = createAuthClient(httpClient);

const readProfile = async (cookie: string): Promise<UserBody> =>
  readJson<UserBody>(await getJson('/api/v1/users/me', cookie));

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  configureTestEnvironment(databaseUrl);
  await runMigrations(databaseUrl);
  ({ app, baseUrl } = await bootIntegrationApp());
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe('users profile update (Testcontainers Postgres)', () => {
  it('persists a profile update and reflects it on a subsequent read', async () => {
    const cookie = await registerAndSignIn(buildTestUser('persist'));

    const patchResponse = await patchJson(
      '/api/v1/users/me',
      { name: 'Ann Updated', locale: 'uk', defaultCurrency: 'UAH' },
      cookie,
    );
    const patchBody = await readJson<UserBody>(patchResponse);
    const expectedProfile = { name: 'Ann Updated', locale: 'uk', defaultCurrency: 'UAH' };

    expect(patchResponse.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(patchBody).toMatchObject(expectedProfile);
    expect(await readProfile(cookie)).toMatchObject(expectedProfile);
  });

  it('scopes the update to the session user and never touches another user', async () => {
    const userA = buildTestUser('scope-a');
    const userB = buildTestUser('scope-b');
    const cookieA = await registerAndSignIn(userA);
    const cookieB = await registerAndSignIn(userB);

    await patchJson('/api/v1/users/me', { name: 'A Updated', locale: 'uk' }, cookieA);
    await patchJson('/api/v1/users/me', { name: 'B Updated', locale: 'en' }, cookieB);

    const [bodyA, bodyB] = await Promise.all([readProfile(cookieA), readProfile(cookieB)]);

    expect(bodyA).toMatchObject({ email: userA.email, name: 'A Updated', locale: 'uk' });
    expect(bodyB).toMatchObject({ email: userB.email, name: 'B Updated', locale: 'en' });
    expect(bodyA.id).not.toBe(bodyB.id);
  });

  it('starts a fresh user with onboardingCompleted false', async () => {
    const cookie = await registerAndSignIn(buildTestUser('onboarding-fresh'));

    expect(await readProfile(cookie)).toMatchObject({ onboardingCompleted: false });
  });

  it('persists onboardingCompleted true via update and round-trips it on read', async () => {
    const cookie = await registerAndSignIn(buildTestUser('onboarding-complete'));

    const patchResponse = await patchJson(
      '/api/v1/users/me',
      { onboardingCompleted: true },
      cookie,
    );
    const patchBody = await readJson<UserBody>(patchResponse);

    expect(patchResponse.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(patchBody.onboardingCompleted).toBe(true);
    expect(await readProfile(cookie)).toMatchObject({ onboardingCompleted: true });
  });

  it('rejects an out-of-list currency with a 400 VALIDATION_ERROR envelope', async () => {
    const cookie = await registerAndSignIn(buildTestUser('invalid-currency'));

    const response = await patchJson('/api/v1/users/me', { defaultCurrency: 'XXX' }, cookie);
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.BadRequest);
    expect(body.code).toBe(ErrorCode.ValidationError);
  });
});
