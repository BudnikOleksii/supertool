import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

const CHANGE_PASSWORD_PATH = '/api/v1/auth/change-password';
const SIGN_IN_PATH = '/api/v1/auth/sign-in/email';
const GET_SESSION_PATH = '/api/v1/auth/get-session';
const NEW_PASSWORD = 'brandnewpass456';

interface ErrorBody {
  code?: string;
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { postJson, getJson, readJson } = httpClient;
const { signUp, signInForCookie } = createAuthClient(httpClient);

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

describe('change-password boundary (Testcontainers Postgres)', () => {
  it('changes the password so the new one signs in and the old one is rejected', async () => {
    const user = buildTestUser('change-success');
    await signUp(user);
    const cookie = await signInForCookie(user);

    const changeResponse = await postJson(
      CHANGE_PASSWORD_PATH,
      { currentPassword: user.password, newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(changeResponse.status).toBe(HTTP_STATUS_CODE.Ok);

    const newPasswordSignIn = await postJson(SIGN_IN_PATH, {
      email: user.email,
      password: NEW_PASSWORD,
    });
    expect(newPasswordSignIn.status).toBe(HTTP_STATUS_CODE.Ok);

    const oldPasswordSignIn = await postJson(SIGN_IN_PATH, {
      email: user.email,
      password: user.password,
    });
    expect(oldPasswordSignIn.status).toBe(HTTP_STATUS_CODE.Unauthorized);
  });

  it('rejects a change with a wrong current password', async () => {
    const user = buildTestUser('change-wrong-current');
    await signUp(user);
    const cookie = await signInForCookie(user);

    const response = await postJson(
      CHANGE_PASSWORD_PATH,
      { currentPassword: 'not-the-current-password', newPassword: NEW_PASSWORD },
      cookie,
    );
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.BadRequest);
    expect(body.code).toBe('INVALID_PASSWORD');
  });

  it('rejects an unauthenticated change-password request', async () => {
    const user = buildTestUser('change-unauthenticated');
    await signUp(user);

    const response = await postJson(CHANGE_PASSWORD_PATH, {
      currentPassword: user.password,
      newPassword: NEW_PASSWORD,
    });

    expect(response.status).toBe(HTTP_STATUS_CODE.Unauthorized);
  });

  it('keeps the original session valid after a change without revokeOtherSessions', async () => {
    const user = buildTestUser('change-session-preserved');
    await signUp(user);
    const cookie = await signInForCookie(user);

    const changeResponse = await postJson(
      CHANGE_PASSWORD_PATH,
      { currentPassword: user.password, newPassword: NEW_PASSWORD },
      cookie,
    );
    expect(changeResponse.status).toBe(HTTP_STATUS_CODE.Ok);

    const sessionResponse = await getJson(GET_SESSION_PATH, cookie);
    expect(sessionResponse.status).toBe(HTTP_STATUS_CODE.Ok);
  });
});
