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
const HTTP_BAD_REQUEST = 400;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

interface TestUser {
  name: string;
  email: string;
  password: string;
}

const buildTestUser = (suffix: string): TestUser => ({
  name: `User ${suffix}`,
  email: `${suffix}@example.com`,
  password: 'supersecret123',
});

interface UserBody {
  id: string;
  email: string;
  name: string;
  role: string;
  locale: string;
  defaultCurrency: string | null;
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

const patchJson = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
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

const signUp = async (user: TestUser): Promise<Response> =>
  postJson('/api/v1/auth/sign-up/email', user);

const signInForCookie = async (user: TestUser): Promise<string> =>
  extractSessionCookie(
    await postJson('/api/v1/auth/sign-in/email', { email: user.email, password: user.password }),
  );

const registerAndSignIn = async (user: TestUser): Promise<string> => {
  await signUp(user);
  return signInForCookie(user);
};

const readProfile = async (cookie: string): Promise<UserBody> =>
  readJson<UserBody>(await getJson('/api/v1/users/me', cookie));

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
  try {
    await migrate(drizzle(migrationPool), { migrationsFolder });
  } finally {
    await migrationPool.end();
  }
};

const bootApp = async (): Promise<INestApplication> => {
  const { AppModule } = await import('../../src/app/app.module.js');
  const { configureAppRouting } = await import('../../src/app/configure-app-routing.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const nestApp = moduleRef.createNestApplication({ bodyParser: false });
  configureAppRouting(nestApp);
  await nestApp.listen(0);

  return nestApp;
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;
  configureTestEnvironment(databaseUrl);
  await runMigrations(databaseUrl);
  app = await bootApp();
  baseUrl = await app.getUrl();
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

    expect(patchResponse.status).toBe(HTTP_OK);
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

  it('rejects an out-of-list currency with a 400 VALIDATION_ERROR envelope', async () => {
    const cookie = await registerAndSignIn(buildTestUser('invalid-currency'));

    const response = await patchJson('/api/v1/users/me', { defaultCurrency: 'XXX' }, cookie);
    const body = await readJson<ErrorBody>(response);

    expect(response.status).toBe(HTTP_BAD_REQUEST);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
