import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import type { TestUser } from '../helpers/auth-client.js';

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
}

interface CategoryBody {
  id: string;
}

interface OwnedDataCounts {
  transactions: number;
  categories: number;
  sessions: number;
  accounts: number;
  users: number;
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let pool: Pool | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { readJson, getJson, postJson, deleteJson } = httpClient;
const authClient = createAuthClient(httpClient);

const requirePool = (): Pool => {
  if (!pool) {
    throw new Error('postgres pool is not initialized');
  }

  return pool;
};

const readUserId = async (cookie: string): Promise<string> => {
  const body = await readJson<UserBody>(await getJson('/api/v1/users/me', cookie));

  return body.id;
};

const createCategory = async (
  cookie: string,
  body: { name: string; type: string; parentId?: string },
): Promise<string> => {
  const created = await readJson<CategoryBody>(
    await postJson('/api/v1/transaction-categories', body, cookie),
  );

  return created.id;
};

const seedUserWithHierarchy = async (user: TestUser): Promise<string> => {
  const cookie = await authClient.registerAndSignIn(user);
  const userId = await readUserId(cookie);

  const parentId = await createCategory(cookie, { name: 'Housing', type: 'expense' });
  const childId = await createCategory(cookie, { name: 'Rent', type: 'expense', parentId });

  await postJson(
    '/api/v1/transactions',
    { categoryId: childId, type: 'expense', amount: '100.00', currency: 'USD', date: '2025-01-01' },
    cookie,
  );
  await postJson(
    '/api/v1/transactions',
    { categoryId: parentId, type: 'expense', amount: '50.00', currency: 'USD', date: '2025-01-02' },
    cookie,
  );

  return userId;
};

const countRows = async (table: string, userColumn: string, userId: string): Promise<number> => {
  const result = await requirePool().query<{ count: string }>(
    `SELECT count(*)::int AS count FROM ${table} WHERE ${userColumn} = $1`,
    [userId],
  );

  return Number(result.rows[0]?.count ?? 0);
};

const readOwnedDataCounts = async (userId: string): Promise<OwnedDataCounts> => ({
  transactions: await countRows('transactions', 'user_id', userId),
  categories: await countRows('transaction_categories', 'user_id', userId),
  sessions: await countRows('sessions', 'user_id', userId),
  accounts: await countRows('accounts', 'user_id', userId),
  users: await countRows('users', 'id', userId),
});

const expectFullyPresent = (counts: OwnedDataCounts): void => {
  expect(counts).toMatchObject({ transactions: 2, categories: 2, users: 1 });
  expect(counts.sessions).toBeGreaterThan(0);
  expect(counts.accounts).toBeGreaterThan(0);
};

const seedTwoUsers = async (): Promise<{ userAId: string; userBId: string; cookieA: string }> => {
  const userA = buildTestUser('delete-a');
  const userB = buildTestUser('delete-b');
  const userAId = await seedUserWithHierarchy(userA);
  const userBId = await seedUserWithHierarchy(userB);
  const cookieA = await authClient.signInForCookie(userA);

  return { userAId, userBId, cookieA };
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  configureTestEnvironment(databaseUrl);
  await runMigrations(databaseUrl);
  pool = new Pool({ connectionString: databaseUrl });
  ({ app, baseUrl } = await bootIntegrationApp());
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await stopIntegrationApp({ app, container, poolList: [pool] });
});

describe('delete account cascade (Testcontainers Postgres)', () => {
  it('purges all of the acting user data, ends the session, and leaves other users intact', async () => {
    const { userAId, userBId, cookieA } = await seedTwoUsers();

    expectFullyPresent(await readOwnedDataCounts(userAId));

    const deleteResponse = await deleteJson('/api/v1/users/me', undefined, cookieA);
    expect(deleteResponse.status).toBe(HTTP_STATUS_CODE.NoContent);

    expect(await readOwnedDataCounts(userAId)).toEqual({
      transactions: 0,
      categories: 0,
      sessions: 0,
      accounts: 0,
      users: 0,
    });
    expectFullyPresent(await readOwnedDataCounts(userBId));

    const staleSessionResponse = await getJson('/api/v1/users/me', cookieA);
    expect(staleSessionResponse.status).toBe(HTTP_STATUS_CODE.Unauthorized);
  });

  it('rejects an unauthenticated delete-account request with 401', async () => {
    const response = await deleteJson('/api/v1/users/me', undefined);

    expect(response.status).toBe(HTTP_STATUS_CODE.Unauthorized);
  });
});
