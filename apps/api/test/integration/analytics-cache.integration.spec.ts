import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { Pool } from 'pg';
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

const SEED_CURRENCY = 'UAH';
const WINDOW = { dateFrom: '2040-01-01', dateTo: '2040-01-31' };
const IN_WINDOW_DATE = '2040-01-10';
const SUMMARY_PATH = `/api/v1/analytics/summary?dateFrom=${WINDOW.dateFrom}&dateTo=${WINDOW.dateTo}`;
const TOP_CATEGORIES_PATH = `/api/v1/analytics/top-categories?dateFrom=${WINDOW.dateFrom}&dateTo=${WINDOW.dateTo}`;
const BY_CATEGORY_PATH = `/api/v1/analytics/by-category?dateFrom=${WINDOW.dateFrom}&dateTo=${WINDOW.dateTo}`;
const OVER_RANGE_SUMMARY_PATH = '/api/v1/analytics/summary?dateFrom=2020-01-01&dateTo=2025-06-01';
const CATEGORIES_PATH = '/api/v1/transaction-categories';
const DEFAULTS_PATH = '/api/v1/transaction-categories/defaults';
const TRANSACTIONS_PATH = '/api/v1/transactions';
const BULK_DELETE_PATH = '/api/v1/transactions/bulk-delete';
const IMPORT_PATH = '/api/v1/transactions/import';

interface SummaryBody {
  income: string;
  expense: string;
  net: string;
  currency: string;
}

interface TopCategoriesBody {
  categories: { rank: number; categoryId: string; categoryName: string; total: string }[];
  totalExpense: string;
  currency: string;
}

interface ByCategoryBody {
  categories: { categoryId: string; categoryName: string }[];
  currency: string;
}

interface CategoryBody {
  id: string;
  name: string;
}

interface TransactionBody {
  id: string;
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let pool: Pool | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { readJson, getJson, postJson, patchJson, deleteJson } = httpClient;
const { registerAndSignIn } = createAuthClient(httpClient);

const requirePool = (): Pool => {
  if (pool === undefined) {
    throw new Error('expected the test database pool to be initialised');
  }

  return pool;
};

const setDefaultCurrency = async (email: string): Promise<void> => {
  await requirePool().query('UPDATE users SET default_currency = $1 WHERE email = $2', [
    SEED_CURRENCY,
    email,
  ]);
};

const registerCurrencyUser = async (suffix: string): Promise<string> => {
  const user = buildTestUser(suffix);
  const cookie = await registerAndSignIn(user);
  await setDefaultCurrency(user.email);

  return cookie;
};

const createCategory = async (
  cookie: string,
  name: string,
  type = 'expense',
): Promise<CategoryBody> =>
  readJson<CategoryBody>(await postJson(CATEGORIES_PATH, { name, type }, cookie));

const createTransaction = async (
  cookie: string,
  input: { categoryId: string; amount: string },
): Promise<TransactionBody> =>
  readJson<TransactionBody>(
    await postJson(
      TRANSACTIONS_PATH,
      {
        type: 'expense',
        amount: input.amount,
        currency: SEED_CURRENCY,
        categoryId: input.categoryId,
        date: IN_WINDOW_DATE,
      },
      cookie,
    ),
  );

const seedExpense = async (cookie: string, name: string, amount: string): Promise<void> => {
  const category = await createCategory(cookie, name);
  await createTransaction(cookie, { categoryId: category.id, amount });
};

const getSummary = async (cookie: string): Promise<SummaryBody> =>
  readJson<SummaryBody>(await getJson(SUMMARY_PATH, cookie));

const getSummaryExpense = async (cookie: string): Promise<string> => {
  const summary = await getSummary(cookie);

  return summary.expense;
};

const getTopCategoryNameList = async (cookie: string): Promise<string[]> => {
  const body = await readJson<TopCategoriesBody>(await getJson(TOP_CATEGORIES_PATH, cookie));

  return body.categories.map((row) => row.categoryName);
};

const getByCategoryNameList = async (cookie: string): Promise<string[]> => {
  const body = await readJson<ByCategoryBody>(await getJson(BY_CATEGORY_PATH, cookie));

  return body.categories.map((row) => row.categoryName);
};

const importCsv = async (cookie: string, csv: string): Promise<Response> => {
  const formData = new FormData();
  formData.append('file', new Blob([csv], { type: 'application/octet-stream' }), 'import.csv');

  return fetch(`${baseUrl}${IMPORT_PATH}`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: formData,
  });
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

describe('analytics response cache (Testcontainers Postgres, HTTP)', () => {
  it('serves a warm repeat read as a byte-identical payload with exact string amounts (AC1, D1)', async () => {
    const cookie = await registerCurrencyUser('cache-hit');
    await seedExpense(cookie, 'Food', '123.45');

    const cold = await getSummary(cookie);
    const warm = await getSummary(cookie);

    expect(cold.expense).toBe('123.45');
    expect(typeof warm.expense).toBe('string');
    expect(warm).toEqual(cold);
  });

  it('refreshes the cache after a transaction create (no stale figures)', async () => {
    const cookie = await registerCurrencyUser('inv-create');
    const category = await createCategory(cookie, 'Food');
    await createTransaction(cookie, { categoryId: category.id, amount: '100.00' });

    expect(await getSummaryExpense(cookie)).toBe('100.00');

    await createTransaction(cookie, { categoryId: category.id, amount: '50.00' });

    expect(await getSummaryExpense(cookie)).toBe('150.00');
  });

  it('refreshes the cache after a transaction update', async () => {
    const cookie = await registerCurrencyUser('inv-update');
    const category = await createCategory(cookie, 'Food');
    const transaction = await createTransaction(cookie, {
      categoryId: category.id,
      amount: '100.00',
    });

    expect(await getSummaryExpense(cookie)).toBe('100.00');

    await patchJson(
      `${TRANSACTIONS_PATH}/${transaction.id}`,
      {
        type: 'expense',
        amount: '200.00',
        currency: SEED_CURRENCY,
        categoryId: category.id,
        date: IN_WINDOW_DATE,
      },
      cookie,
    );

    expect(await getSummaryExpense(cookie)).toBe('200.00');
  });

  it('refreshes the cache after a transaction delete', async () => {
    const cookie = await registerCurrencyUser('inv-delete');
    const category = await createCategory(cookie, 'Food');
    const transaction = await createTransaction(cookie, {
      categoryId: category.id,
      amount: '100.00',
    });

    expect(await getSummaryExpense(cookie)).toBe('100.00');

    await deleteJson(`${TRANSACTIONS_PATH}/${transaction.id}`, {}, cookie);

    expect(await getSummaryExpense(cookie)).toBe('0.00');
  });

  it('refreshes the cache after a bulk delete', async () => {
    const cookie = await registerCurrencyUser('inv-bulk');
    const category = await createCategory(cookie, 'Food');
    const transaction = await createTransaction(cookie, {
      categoryId: category.id,
      amount: '100.00',
    });

    expect(await getSummaryExpense(cookie)).toBe('100.00');

    await postJson(BULK_DELETE_PATH, { idList: [transaction.id] }, cookie);

    expect(await getSummaryExpense(cookie)).toBe('0.00');
  });

  it('refreshes the cache after an import', async () => {
    const cookie = await registerCurrencyUser('inv-import');

    expect(await getSummaryExpense(cookie)).toBe('0.00');

    const csv = [
      'Date,Category,Type,Amount,Currency',
      `${IN_WINDOW_DATE},Groceries,Expense,75.00,${SEED_CURRENCY}`,
    ].join('\n');
    const importResponse = await importCsv(cookie, csv);

    expect(importResponse.status).toBe(HTTP_STATUS_CODE.Created);
    expect(await getSummaryExpense(cookie)).toBe('75.00');
  });

  it('refreshes the cache after assigning default categories', async () => {
    const cookie = await registerCurrencyUser('inv-defaults');

    expect(await getByCategoryNameList(cookie)).toHaveLength(0);

    await postJson(DEFAULTS_PATH, {}, cookie);

    const nameList = await getByCategoryNameList(cookie);
    expect(nameList.length).toBeGreaterThan(0);
  });

  it('refreshes the cache after a category create', async () => {
    const cookie = await registerCurrencyUser('inv-cat-create');

    expect(await getByCategoryNameList(cookie)).toHaveLength(0);

    await createCategory(cookie, 'Food');

    expect(await getByCategoryNameList(cookie)).toContain('Food');
  });
});

describe('analytics cache isolation, ordering, and range clamp (Testcontainers Postgres, HTTP)', () => {
  it('refreshes the cache after a category rename', async () => {
    const cookie = await registerCurrencyUser('inv-cat-update');
    const category = await createCategory(cookie, 'Food');
    await createTransaction(cookie, { categoryId: category.id, amount: '100.00' });

    expect(await getTopCategoryNameList(cookie)).toContain('Food');

    await patchJson(`${CATEGORIES_PATH}/${category.id}`, { name: 'Meals' }, cookie);

    expect(await getTopCategoryNameList(cookie)).toContain('Meals');
  });

  it('refreshes the cache after a category delete with reassignment', async () => {
    const cookie = await registerCurrencyUser('inv-cat-delete');
    const source = await createCategory(cookie, 'Source');
    const target = await createCategory(cookie, 'Target');
    await createTransaction(cookie, { categoryId: source.id, amount: '100.00' });

    expect(await getTopCategoryNameList(cookie)).toContain('Source');

    await deleteJson(
      `${CATEGORIES_PATH}/${source.id}`,
      { reassignTransactionsToCategoryId: target.id },
      cookie,
    );

    const refreshedNameList = await getTopCategoryNameList(cookie);
    expect(refreshedNameList).not.toContain('Source');
    expect(refreshedNameList).toContain('Target');
  });

  it('never leaks one user cache to another and scopes invalidation per user (AC4, security)', async () => {
    const cookieA = await registerCurrencyUser('iso-a');
    const cookieB = await registerCurrencyUser('iso-b');
    await seedExpense(cookieA, 'Food', '100.00');
    await seedExpense(cookieB, 'Food', '250.00');

    expect(await getSummaryExpense(cookieA)).toBe('100.00');
    expect(await getSummaryExpense(cookieB)).toBe('250.00');

    await seedExpense(cookieB, 'Extra', '50.00');

    expect(await getSummaryExpense(cookieB)).toBe('300.00');
    expect(await getSummaryExpense(cookieA)).toBe('100.00');
  });

  it('orders equal-total top categories deterministically across repeated reads (AC6, tie-break)', async () => {
    const cookie = await registerCurrencyUser('tie-break');
    const alpha = await createCategory(cookie, 'Alpha');
    const beta = await createCategory(cookie, 'Beta');
    await createTransaction(cookie, { categoryId: alpha.id, amount: '50.00' });
    await createTransaction(cookie, { categoryId: beta.id, amount: '50.00' });

    const firstNameList = await getTopCategoryNameList(cookie);
    const secondNameList = await getTopCategoryNameList(cookie);

    expect(firstNameList).toEqual(['Alpha', 'Beta']);
    expect(secondNameList).toEqual(firstNameList);
  });

  it('rejects an over-range window with 400 and accepts an in-bound window with 200 (AC7)', async () => {
    const cookie = await registerCurrencyUser('range-clamp');

    const overRange = await getJson(OVER_RANGE_SUMMARY_PATH, cookie);
    const withinRange = await getJson(SUMMARY_PATH, cookie);

    expect(overRange.status).toBe(HTTP_STATUS_CODE.BadRequest);
    expect(withinRange.status).toBe(HTTP_STATUS_CODE.Ok);
  });
});
