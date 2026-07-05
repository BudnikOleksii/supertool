import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import { createAuthClient, extractSessionCookie } from '../helpers/auth-client.js';
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

const USER_A = {
  name: 'Ann Smith',
  firstName: 'Ann',
  lastName: 'Smith',
  email: 'ann@example.com',
  password: 'supersecret123',
};
const USER_B = {
  name: 'Bob Brown',
  firstName: 'Bob',
  lastName: 'Brown',
  email: 'bob@example.com',
  password: 'supersecret456',
};

interface UserBody {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface SessionBody {
  user: UserBody;
}

interface ErrorBody {
  code: string;
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { readJson, getJson } = httpClient;
const { signUp, signIn, signInForCookie } = createAuthClient(httpClient);

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

describe('auth boundary (Testcontainers Postgres)', () => {
  it('signs up a new user and returns the created identity with the default role', async () => {
    const response = await signUp(USER_A);
    const body = await readJson<SessionBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(body.user.email).toBe(USER_A.email);
    expect(body.user.name).toBe(USER_A.name);
    expect(body.user.role).toBe('user');
  });

  it('signs in and sets a better-auth session cookie', async () => {
    const response = await signIn(USER_A);

    expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(extractSessionCookie(response)).toContain('better-auth.session_token=');
  });

  it('validates an active session via get-session', async () => {
    const cookie = await signInForCookie(USER_A);
    const response = await getJson('/api/v1/auth/get-session', cookie);
    const body = await readJson<SessionBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(body.user.email).toBe(USER_A.email);
  });

  it('returns 401 from /api/v1/users/me without a session', async () => {
    const response = await getJson('/api/v1/users/me');
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Unauthorized);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns the authenticated user from /api/v1/users/me with a session', async () => {
    const cookie = await signInForCookie(USER_A);
    const response = await getJson('/api/v1/users/me', cookie);
    const body = await readJson<UserBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(body).toEqual({
      id: expect.any(String),
      email: USER_A.email,
      name: USER_A.name,
      firstName: USER_A.firstName,
      lastName: USER_A.lastName,
      role: 'user',
      locale: 'en',
      defaultCurrency: null,
      onboardingCompleted: false,
    });
  });

  it('keeps two concurrent sessions valid at the same time', async () => {
    const firstCookie = await signInForCookie(USER_A);
    const secondCookie = await signInForCookie(USER_A);

    expect(firstCookie).not.toBe(secondCookie);

    const firstResponse = await getJson('/api/v1/users/me', firstCookie);
    const secondResponse = await getJson('/api/v1/users/me', secondCookie);

    expect(firstResponse.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(secondResponse.status).toBe(HTTP_STATUS_CODE.Ok);
  });

  it('never returns another user data through /api/v1/users/me (cross-user scoping)', async () => {
    await signUp(USER_B);
    const cookieA = await signInForCookie(USER_A);
    const cookieB = await signInForCookie(USER_B);

    const bodyA = await readJson<UserBody>(await getJson('/api/v1/users/me', cookieA));
    const bodyB = await readJson<UserBody>(await getJson('/api/v1/users/me', cookieB));

    expect(bodyA.email).toBe(USER_A.email);
    expect(bodyB.email).toBe(USER_B.email);
    expect(bodyA.email).not.toBe(bodyB.email);
    expect(bodyA.id).not.toBe(bodyB.id);
  });
});
