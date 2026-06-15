import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const POSTGRES_PORT = 5432;
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNPROCESSABLE = 422;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;
const NO_ROWS = 0;
const EXPECTED_TARGET_TRANSACTIONS = 2;
const EXPECTED_GRANDCHILD_TRANSACTIONS = 1;

const CATEGORIES_PATH = '/api/v1/transaction-categories';
const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

interface TestUser {
  name: string;
  email: string;
  password: string;
}

interface CategoryBody {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

const buildTestUser = (suffix: string): TestUser => ({
  name: `User ${suffix}`,
  email: `${suffix}@example.com`,
  password: 'supersecret123',
});

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let pool: Pool | undefined = undefined;
let baseUrl = '';

const requirePool = (): Pool => {
  if (pool === undefined) {
    throw new Error('expected the test database pool to be initialised');
  }

  return pool;
};

const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const buildHeaders = (cookie?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(cookie === undefined ? {} : { Cookie: cookie }),
});

const postJson = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: buildHeaders(cookie),
    body: JSON.stringify(body),
  });

const patchJson = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(cookie),
    body: JSON.stringify(body),
  });

const deleteJson = async (path: string, body: unknown, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(cookie),
    body: JSON.stringify(body),
  });

const getJson = async (path: string, cookie?: string): Promise<Response> =>
  fetch(`${baseUrl}${path}`, { headers: cookie === undefined ? {} : { Cookie: cookie } });

const extractSessionCookie = (response: Response): string => {
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('better-auth.session_token='));

  if (sessionCookie === undefined) {
    throw new Error('expected a better-auth session cookie in the response');
  }

  return sessionCookie.split(';')[0] ?? '';
};

const registerAndSignIn = async (user: TestUser): Promise<string> => {
  await postJson('/api/v1/auth/sign-up/email', user);

  return extractSessionCookie(
    await postJson('/api/v1/auth/sign-in/email', { email: user.email, password: user.password }),
  );
};

const createCategory = async (
  cookie: string,
  body: { name: string; type: string; parentId?: string },
): Promise<CategoryBody> => readJson<CategoryBody>(await postJson(CATEGORIES_PATH, body, cookie));

const listCategories = async (cookie: string): Promise<CategoryBody[]> =>
  readJson<CategoryBody[]>(await getJson(CATEGORIES_PATH, cookie));

const resolveUserId = async (email: string): Promise<string> => {
  const result = await requirePool().query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email],
  );
  const userId = result.rows[0]?.id;

  if (userId === undefined) {
    throw new Error(`expected a user row for ${email}`);
  }

  return userId;
};

const insertTransaction = async (input: {
  userId: string;
  categoryId: string;
  type: string;
}): Promise<void> => {
  await requirePool().query(
    `INSERT INTO transactions (id, user_id, category_id, type, amount, currency, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), input.userId, input.categoryId, input.type, '10.00', 'USD', '2026-01-01'],
  );
};

const countTransactionsForCategory = async (categoryId: string): Promise<number> => {
  const result = await requirePool().query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM transactions WHERE category_id = $1',
    [categoryId],
  );

  return Number(result.rows[0]?.count ?? NO_ROWS);
};

const countChildrenForParent = async (parentId: string): Promise<number> => {
  const result = await requirePool().query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM transaction_categories WHERE parent_id = $1',
    [parentId],
  );

  return Number(result.rows[0]?.count ?? NO_ROWS);
};

interface ReassignScenario {
  parent: CategoryBody;
  branchToDelete: CategoryBody;
  reassignTarget: CategoryBody;
  grandchild: CategoryBody;
}

const seedReassignScenario = async (cookie: string, userId: string): Promise<ReassignScenario> => {
  const parent = await createCategory(cookie, { name: 'Bills', type: 'expense' });
  const branchToDelete = await createCategory(cookie, {
    name: 'Utilities',
    type: 'expense',
    parentId: parent.id,
  });
  const reassignTarget = await createCategory(cookie, {
    name: 'Subscriptions',
    type: 'expense',
    parentId: parent.id,
  });
  const grandchild = await createCategory(cookie, {
    name: 'Water',
    type: 'expense',
    parentId: branchToDelete.id,
  });

  await insertTransaction({ userId, categoryId: branchToDelete.id, type: 'expense' });
  await insertTransaction({ userId, categoryId: branchToDelete.id, type: 'expense' });
  await insertTransaction({ userId, categoryId: grandchild.id, type: 'expense' });

  return { parent, branchToDelete, reassignTarget, grandchild };
};

const verifyReassignIntegrity = async (
  scenario: ReassignScenario,
  cookie: string,
): Promise<void> => {
  const remainingList = await listCategories(cookie);
  const movedGrandchild = remainingList.find((category) => category.id === scenario.grandchild.id);

  expect(remainingList.map((category) => category.id)).not.toContain(scenario.branchToDelete.id);
  expect(await countTransactionsForCategory(scenario.branchToDelete.id)).toBe(NO_ROWS);
  expect(await countTransactionsForCategory(scenario.reassignTarget.id)).toBe(
    EXPECTED_TARGET_TRANSACTIONS,
  );
  expect(await countTransactionsForCategory(scenario.grandchild.id)).toBe(
    EXPECTED_GRANDCHILD_TRANSACTIONS,
  );
  expect(await countChildrenForParent(scenario.branchToDelete.id)).toBe(NO_ROWS);
  expect(movedGrandchild?.parentId).toBe(scenario.parent.id);
};

interface DependentsScenario {
  withTransactions: CategoryBody;
  withChildrenParent: CategoryBody;
}

const seedDependentsScenario = async (
  cookie: string,
  userId: string,
): Promise<DependentsScenario> => {
  const withTransactions = await createCategory(cookie, { name: 'Groceries', type: 'expense' });
  const withChildrenParent = await createCategory(cookie, { name: 'Income', type: 'income' });

  await insertTransaction({ userId, categoryId: withTransactions.id, type: 'expense' });
  await createCategory(cookie, {
    name: 'Salary',
    type: 'income',
    parentId: withChildrenParent.id,
  });

  return { withTransactions, withChildrenParent };
};

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
  pool = new Pool({ connectionString: databaseUrl });
  app = await bootApp();
  baseUrl = await app.getUrl();
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await app?.close();
  await pool?.end();
  await container?.stop();
});

describe('transaction categories (Testcontainers Postgres)', () => {
  it('conserves transactions and children with zero orphans on delete-with-reassignment', async () => {
    const user = buildTestUser('reassign');
    const cookie = await registerAndSignIn(user);
    const userId = await resolveUserId(user.email);
    const scenario = await seedReassignScenario(cookie, userId);

    const response = await deleteJson(
      `${CATEGORIES_PATH}/${scenario.branchToDelete.id}`,
      {
        reassignTransactionsToCategoryId: scenario.reassignTarget.id,
        reassignChildrenToParentId: scenario.parent.id,
      },
      cookie,
    );

    expect(response.status).toBe(HTTP_NO_CONTENT);
    await verifyReassignIntegrity(scenario, cookie);
  });

  it('rejects deleting a category with dependents when targets are missing (422)', async () => {
    const user = buildTestUser('dependents');
    const cookie = await registerAndSignIn(user);
    const userId = await resolveUserId(user.email);
    const scenario = await seedDependentsScenario(cookie, userId);

    const transactionResponse = await deleteJson(
      `${CATEGORIES_PATH}/${scenario.withTransactions.id}`,
      {},
      cookie,
    );
    const childrenResponse = await deleteJson(
      `${CATEGORIES_PATH}/${scenario.withChildrenParent.id}`,
      {},
      cookie,
    );

    expect(transactionResponse.status).toBe(HTTP_UNPROCESSABLE);
    expect(childrenResponse.status).toBe(HTTP_UNPROCESSABLE);
  });

  it('prevents moving a category under one of its descendants (409)', async () => {
    const cookie = await registerAndSignIn(buildTestUser('cycle'));
    const parent = await createCategory(cookie, { name: 'Travel', type: 'expense' });
    const child = await createCategory(cookie, {
      name: 'Flights',
      type: 'expense',
      parentId: parent.id,
    });

    const response = await patchJson(
      `${CATEGORIES_PATH}/${parent.id}`,
      { parentId: child.id },
      cookie,
    );

    expect(response.status).toBe(HTTP_CONFLICT);
  });

  it('scopes reads, updates, and deletes to the owning user (404 across users)', async () => {
    const ownerCookie = await registerAndSignIn(buildTestUser('owner'));
    const intruderCookie = await registerAndSignIn(buildTestUser('intruder'));
    const ownerCategory = await createCategory(ownerCookie, { name: 'Private', type: 'expense' });

    const intruderList = await listCategories(intruderCookie);
    const renameResponse = await patchJson(
      `${CATEGORIES_PATH}/${ownerCategory.id}`,
      { name: 'Hijacked' },
      intruderCookie,
    );
    const deleteResponse = await deleteJson(
      `${CATEGORIES_PATH}/${ownerCategory.id}`,
      {},
      intruderCookie,
    );

    expect(intruderList.map((category) => category.id)).not.toContain(ownerCategory.id);
    expect(renameResponse.status).toBe(HTTP_NOT_FOUND);
    expect(deleteResponse.status).toBe(HTTP_NOT_FOUND);
  });

  it('creates and lists a category for the owner', async () => {
    const cookie = await registerAndSignIn(buildTestUser('create-list'));

    const created = await postJson(CATEGORIES_PATH, { name: 'Salary', type: 'income' }, cookie);
    const listResponse = await getJson(CATEGORIES_PATH, cookie);
    const list = await readJson<CategoryBody[]>(listResponse);

    expect(created.status).toBe(HTTP_CREATED);
    expect(listResponse.status).toBe(HTTP_OK);
    expect(list.some((category) => category.name === 'Salary')).toBe(true);
  });
});
