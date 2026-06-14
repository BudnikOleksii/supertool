import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const POSTGRES_PORT = 5432;
const HTTP_OK = 200;
const HTTP_UNAUTHORIZED = 401;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;

const USER_A = { name: 'Ann', email: 'ann@example.com', password: 'supersecret123' };
const USER_B = { name: 'Bob', email: 'bob@example.com', password: 'supersecret456' };

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

interface UserBody {
  id: string;
  email: string;
  name: string;
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

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const postJson = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  });

const getJson = async (path: string, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    headers: cookie === undefined ? {} : { Cookie: cookie },
  });

const extractSessionCookie = (response: Response): string => {
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('better-auth.session_token='));

  if (sessionCookie === undefined) {
    throw new Error('expected a better-auth session cookie in the response');
  }

  return sessionCookie.split(';')[0] ?? '';
};

const signUp = async (user: typeof USER_A): Promise<Response> =>
  postJson('/api/auth/sign-up/email', user);

const signIn = async (user: typeof USER_A): Promise<Response> =>
  postJson('/api/auth/sign-in/email', { email: user.email, password: user.password });

const signInForCookie = async (user: typeof USER_A): Promise<string> =>
  extractSessionCookie(await signIn(user));

const startPostgresContainer = async (): Promise<StartedTestContainer> =>
  new GenericContainer('postgres:16-alpine')
    .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
    .withExposedPorts(POSTGRES_PORT)
    .withWaitStrategy(
      Wait.forLogMessage(
        /database system is ready to accept connections/u,
        CONTAINER_READY_OCCURRENCES,
      ),
    )
    .start();

const configureTestEnvironment = (databaseUrl: string): void => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.BETTER_AUTH_SECRET = 'integration-test-secret';
  process.env.AUTH_RATE_LIMIT_DISABLED = 'true';
};

const runMigrations = async (databaseUrl: string): Promise<void> => {
  const migrationPool = new Pool({ connectionString: databaseUrl });
  await migrate(drizzle(migrationPool), { migrationsFolder });
  await migrationPool.end();
};

const bootApp = async (): Promise<{ app: INestApplication }> => {
  const { AppModule } = await import('../../src/app/app.module.js');
  const { configureAppRouting } = await import('../../src/app/configure-app-routing.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const nestApp = moduleRef.createNestApplication({ bodyParser: false });
  configureAppRouting(nestApp);
  await nestApp.listen(0);

  return { app: nestApp };
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;
  configureTestEnvironment(databaseUrl);
  await runMigrations(databaseUrl);
  const booted = await bootApp();
  ({ app } = booted);
  baseUrl = await booted.app.getUrl();
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await app?.close();
  await container?.stop();
});

describe('auth boundary (Testcontainers Postgres)', () => {
  it('signs up a new user and returns the created identity with the default role', async () => {
    const response = await signUp(USER_A);
    const body = await readJson<SessionBody>(response);

    expect(response.status).toBe(HTTP_OK);
    expect(body.user.email).toBe(USER_A.email);
    expect(body.user.name).toBe(USER_A.name);
    expect(body.user.role).toBe('user');
  });

  it('signs in and sets a better-auth session cookie', async () => {
    const response = await signIn(USER_A);

    expect(response.status).toBe(HTTP_OK);
    expect(extractSessionCookie(response)).toContain('better-auth.session_token=');
  });

  it('validates an active session via get-session', async () => {
    const cookie = await signInForCookie(USER_A);
    const response = await getJson('/api/auth/get-session', cookie);
    const body = await readJson<SessionBody>(response);

    expect(response.status).toBe(HTTP_OK);
    expect(body.user.email).toBe(USER_A.email);
  });

  it('returns 401 from /api/v1/users/me without a session', async () => {
    const response = await getJson('/api/v1/users/me');
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(HTTP_UNAUTHORIZED);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns the authenticated user from /api/v1/users/me with a session', async () => {
    const cookie = await signInForCookie(USER_A);
    const response = await getJson('/api/v1/users/me', cookie);
    const body = await readJson<UserBody>(response);

    expect(response.status).toBe(HTTP_OK);
    expect(body).toEqual({
      id: expect.any(String),
      email: USER_A.email,
      name: USER_A.name,
      role: 'user',
    });
  });

  it('keeps two concurrent sessions valid at the same time', async () => {
    const firstCookie = await signInForCookie(USER_A);
    const secondCookie = await signInForCookie(USER_A);

    expect(firstCookie).not.toBe(secondCookie);

    const firstResponse = await getJson('/api/v1/users/me', firstCookie);
    const secondResponse = await getJson('/api/v1/users/me', secondCookie);

    expect(firstResponse.status).toBe(HTTP_OK);
    expect(secondResponse.status).toBe(HTTP_OK);
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
