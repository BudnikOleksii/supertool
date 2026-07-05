import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import { buildTestUser, createAuthClient } from '../helpers/auth-client.js';
import { createHttpClient } from '../helpers/http-client.js';
import {
  bootIntegrationApp,
  configureTestEnvironment,
  stopIntegrationApp,
} from '../helpers/integration-app.js';
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
  firstName: string | null;
  lastName: string | null;
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
  await stopIntegrationApp({ app, container });
});

describe('users profile update (Testcontainers Postgres)', () => {
  it('persists first and last name and recomposes the display name on a subsequent read', async () => {
    const cookie = await registerAndSignIn(buildTestUser('persist'));

    const patchResponse = await patchJson(
      '/api/v1/users/me',
      { firstName: 'Ann', lastName: 'Smith', locale: 'uk', defaultCurrency: 'UAH' },
      cookie,
    );
    const patchBody = await readJson<UserBody>(patchResponse);
    const expectedProfile = {
      firstName: 'Ann',
      lastName: 'Smith',
      name: 'Ann Smith',
      locale: 'uk',
      defaultCurrency: 'UAH',
    };

    expect(patchResponse.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(patchBody).toMatchObject(expectedProfile);
    expect(await readProfile(cookie)).toMatchObject(expectedProfile);
  });

  it('recomposes the display name from a partial PATCH that only changes the first name', async () => {
    const cookie = await registerAndSignIn(buildTestUser('partial-patch'));

    await patchJson('/api/v1/users/me', { firstName: 'Ann', lastName: 'Smith' }, cookie);
    const patchResponse = await patchJson('/api/v1/users/me', { firstName: 'Anna' }, cookie);
    const patchBody = await readJson<UserBody>(patchResponse);

    expect(patchBody).toMatchObject({ firstName: 'Anna', lastName: 'Smith', name: 'Anna Smith' });
    expect(await readProfile(cookie)).toMatchObject({
      firstName: 'Anna',
      lastName: 'Smith',
      name: 'Anna Smith',
    });
  });

  it('persists first and last name captured at sign-up and composes the display name', async () => {
    const cookie = await registerAndSignIn(buildTestUser('signup-names'));

    expect(await readProfile(cookie)).toMatchObject({
      firstName: 'User',
      lastName: 'signup-names',
      name: 'User signup-names',
    });
  });

  it('scopes the update to the session user and never touches another user', async () => {
    const userA = buildTestUser('scope-a');
    const userB = buildTestUser('scope-b');
    const cookieA = await registerAndSignIn(userA);
    const cookieB = await registerAndSignIn(userB);

    await patchJson('/api/v1/users/me', { firstName: 'Alice', lastName: 'Anderson' }, cookieA);
    await patchJson('/api/v1/users/me', { firstName: 'Bob', lastName: 'Brown' }, cookieB);

    const [bodyA, bodyB] = await Promise.all([readProfile(cookieA), readProfile(cookieB)]);

    expect(bodyA).toMatchObject({ email: userA.email, name: 'Alice Anderson' });
    expect(bodyB).toMatchObject({ email: userB.email, name: 'Bob Brown' });
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
