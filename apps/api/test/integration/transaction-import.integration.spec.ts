import type { INestApplication } from '@nestjs/common';
import type { StartedTestContainer } from 'testcontainers';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { HTTP_STATUS_CODE } from '@supertool/shared/constants/http-status-code';

import type { SeedSourceRecord } from '../../src/database/seeds/seed.types.js';
import type { TestUser } from '../helpers/auth-client.js';

import { buildTestUser, createAuthClient } from '../helpers/auth-client.js';
import { getActualSumByCurrency, getExpectedSumByCurrency } from '../helpers/decimal-safe-sums.js';
import { createHttpClient } from '../helpers/http-client.js';
import { bootIntegrationApp, configureTestEnvironment } from '../helpers/integration-app.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  runMigrations,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const IMPORT_PATH = '/api/v1/transactions/import';
const PREVIEW_PATH = '/api/v1/transactions/import/preview';

const JSON_ROW_LIST: SeedSourceRecord[] = [
  {
    Date: '02/03/2025 15:41:17',
    Category: 'Їжа',
    Type: 'Expense',
    Amount: 1588.29,
    Currency: 'UAH',
    Subcategory: 'Кафе',
  },
  { Date: '02/04/2025', Category: 'Їжа', Type: 'Expense', Amount: 10.5, Currency: 'UAH' },
  {
    Date: '02/05/2025 08:00:00',
    Category: 'Зарплата',
    Type: 'Income',
    Amount: 3000,
    Currency: 'USD',
  },
  {
    Date: '02/05/2025',
    Category: 'Транспорт',
    Type: 'expense',
    Amount: '45.05',
    Currency: 'UAH',
    Subcategory: 'Таксі',
  },
];

const JSON_ROW_COUNT = JSON_ROW_LIST.length;
const JSON_TOP_LEVEL_COUNT = 3;
const JSON_CHILD_COUNT = 2;
const NO_ROWS = 0;

const CSV_CONTENT = [
  'Date,Category,Type,Amount,Currency,Subcategory',
  '02/03/2025 15:41:17,Продукти,Expense,99.99,UAH,',
  '02/04/2025,Зарплата,Income,2500,USD,',
].join('\n');

const CSV_ROW_COUNT = 2;

const SECOND_BATCH_ROW_LIST: SeedSourceRecord[] = [
  {
    Date: '03/01/2025',
    Category: 'Їжа',
    Type: 'Expense',
    Amount: 20,
    Currency: 'UAH',
    Subcategory: 'Кафе',
  },
];

interface ImportBody {
  inserted: number;
  skippedDuplicates: number;
  topLevelCategoriesCreated: number;
  childCategoriesCreated: number;
  nearDuplicateClusterList: unknown[];
}

interface PreviewBody {
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  topLevelCategoriesToCreateList: string[];
  childCategoriesToCreateList: string[];
  nearDuplicateClusterList: unknown[];
}

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: { rowErrorList?: string[] };
}

let container: StartedTestContainer | undefined = undefined;
let app: INestApplication | undefined = undefined;
let pool: Pool | undefined = undefined;
let baseUrl = '';

const httpClient = createHttpClient(() => baseUrl);
const { registerAndSignIn } = createAuthClient(httpClient);

const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Postgres pool is not initialised');
  }
  return pool;
};

const signInNewUser = async (suffix: string): Promise<{ cookie: string; userId: string }> => {
  const testUser: TestUser = buildTestUser(suffix);
  const cookie = await registerAndSignIn(testUser);
  const result = await getPool().query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    testUser.email,
  ]);
  const [row] = result.rows;
  if (!row) {
    throw new Error(`user ${testUser.email} was not created`);
  }
  return { cookie, userId: row.id };
};

interface ImportUpload {
  path: string;
  filename: string;
  content: string;
  cookie: string;
}

const postImportFile = async ({
  path,
  filename,
  content,
  cookie,
}: ImportUpload): Promise<Response> => {
  const formData = new FormData();
  formData.append('file', new Blob([content], { type: 'application/octet-stream' }), filename);

  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: formData,
  });
};

const readBody = async <T>(response: Response): Promise<T> => (await response.json()) as T;

const expectSameNameSet = (actualNameList: string[], expectedNameList: string[]): void => {
  expect(new Set(actualNameList)).toEqual(new Set(expectedNameList));
  expect(actualNameList).toHaveLength(expectedNameList.length);
};

const countTransactions = async (userId: string): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0]?.count ?? NO_ROWS;
};

const countCategories = async (userId: string): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transaction_categories WHERE user_id = $1`,
    [userId],
  );
  return result.rows[0]?.count ?? NO_ROWS;
};

const loadTransactionRows = async (
  userId: string,
): Promise<{ amount: string; currency: string; date: string; type: string }[]> => {
  const result = await getPool().query<{
    amount: string;
    currency: string;
    date: string;
    type: string;
  }>(
    `SELECT t.amount::text AS amount, t.currency, t.date::text AS date, t.type::text AS type
     FROM transactions t WHERE t.user_id = $1 ORDER BY t.date, t.amount`,
    [userId],
  );
  return result.rows;
};

const loadCategoryNames = async (
  userId: string,
): Promise<{ topLevelNameList: string[]; childNameList: string[] }> => {
  const result = await getPool().query<{ name: string; parent_id: string | null }>(
    `SELECT name, parent_id FROM transaction_categories WHERE user_id = $1 ORDER BY name`,
    [userId],
  );
  return {
    topLevelNameList: result.rows.filter((row) => row.parent_id === null).map((row) => row.name),
    childNameList: result.rows.filter((row) => row.parent_id !== null).map((row) => row.name),
  };
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
  await pool?.end();
  await app?.close();
  await container?.stop();
});

describe('transaction import (Testcontainers Postgres)', () => {
  it('executes a JSON import with exact amounts, truncated dates, and auto-created categories', async () => {
    const { cookie, userId } = await signInNewUser('import-json');

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const body = await readBody<ImportBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Created);
    expect(body).toMatchObject({
      inserted: JSON_ROW_COUNT,
      skippedDuplicates: NO_ROWS,
      topLevelCategoriesCreated: JSON_TOP_LEVEL_COUNT,
      childCategoriesCreated: JSON_CHILD_COUNT,
    });

    const rowList = await loadTransactionRows(userId);
    expect(rowList).toEqual([
      { amount: '1588.29', currency: 'UAH', date: '2025-02-03', type: 'expense' },
      { amount: '10.50', currency: 'UAH', date: '2025-02-04', type: 'expense' },
      { amount: '45.05', currency: 'UAH', date: '2025-02-05', type: 'expense' },
      { amount: '3000.00', currency: 'USD', date: '2025-02-05', type: 'income' },
    ]);

    const categoryNames = await loadCategoryNames(userId);
    expectSameNameSet(categoryNames.topLevelNameList, ['Зарплата', 'Транспорт', 'Їжа']);
    expectSameNameSet(categoryNames.childNameList, ['Кафе', 'Таксі']);
  });

  it('keeps DB sums decimal-safe per currency', async () => {
    const { cookie, userId } = await signInNewUser('import-sums');

    await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });

    const actualSumByCurrency = await getActualSumByCurrency(getPool(), userId);
    const expectedSumByCurrency = getExpectedSumByCurrency(JSON_ROW_LIST);

    expect(actualSumByCurrency.size).toBe(expectedSumByCurrency.size);
    expectedSumByCurrency.forEach((expectedTotal, currency) => {
      expect(actualSumByCurrency.get(currency)).toBe(expectedTotal);
    });
  });

  it('is idempotent on re-run: the same file inserts zero duplicates', async () => {
    const { cookie, userId } = await signInNewUser('import-rerun');
    await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });

    const rerunResponse = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const body = await readBody<ImportBody>(rerunResponse);

    expect(rerunResponse.status).toBe(HTTP_STATUS_CODE.Created);
    expect(body).toMatchObject({ inserted: NO_ROWS, skippedDuplicates: JSON_ROW_COUNT });
    expect(await countTransactions(userId)).toBe(JSON_ROW_COUNT);
  });

  it('previews the import without writing anything', async () => {
    const { cookie, userId } = await signInNewUser('import-preview');

    const response = await postImportFile({
      path: PREVIEW_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const body = await readBody<PreviewBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Ok);
    expect(body).toMatchObject({
      totalRows: JSON_ROW_COUNT,
      newRows: JSON_ROW_COUNT,
      duplicateRows: NO_ROWS,
    });
    expectSameNameSet(body.topLevelCategoriesToCreateList, ['Зарплата', 'Транспорт', 'Їжа']);
    expectSameNameSet(body.childCategoriesToCreateList, ['Кафе', 'Таксі']);
    expect(await countTransactions(userId)).toBe(NO_ROWS);
    expect(await countCategories(userId)).toBe(NO_ROWS);
  });

  it('reports duplicates and no categories to create when previewing already-imported data', async () => {
    const { cookie, userId } = await signInNewUser('import-preview-dup');
    await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const importedCount = await countTransactions(userId);

    const response = await postImportFile({
      path: PREVIEW_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const body = await readBody<PreviewBody>(response);

    expect(body).toMatchObject({
      totalRows: JSON_ROW_COUNT,
      newRows: NO_ROWS,
      duplicateRows: JSON_ROW_COUNT,
      topLevelCategoriesToCreateList: [],
      childCategoriesToCreateList: [],
    });
    expect(await countTransactions(userId)).toBe(importedCount);
  });

  it('executes a CSV import with string amounts kept decimal-exact', async () => {
    const { cookie, userId } = await signInNewUser('import-csv');

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.csv',
      content: CSV_CONTENT,
      cookie,
    });
    const body = await readBody<ImportBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.Created);
    expect(body).toMatchObject({
      inserted: CSV_ROW_COUNT,
      skippedDuplicates: NO_ROWS,
      topLevelCategoriesCreated: CSV_ROW_COUNT,
      childCategoriesCreated: NO_ROWS,
    });

    const rowList = await loadTransactionRows(userId);
    expect(rowList).toEqual([
      { amount: '99.99', currency: 'UAH', date: '2025-02-03', type: 'expense' },
      { amount: '2500.00', currency: 'USD', date: '2025-02-04', type: 'income' },
    ]);
  });

  it('reuses existing categories on a follow-up import instead of duplicating them', async () => {
    const { cookie, userId } = await signInNewUser('import-reuse');
    await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie,
    });
    const categoryCountAfterFirstImport = await countCategories(userId);

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(SECOND_BATCH_ROW_LIST),
      cookie,
    });
    const body = await readBody<ImportBody>(response);

    expect(body).toMatchObject({
      inserted: SECOND_BATCH_ROW_LIST.length,
      topLevelCategoriesCreated: NO_ROWS,
      childCategoriesCreated: NO_ROWS,
    });
    expect(await countCategories(userId)).toBe(categoryCountAfterFirstImport);
  });

  it('scopes import keys per user: a second user importing the same file gets a full copy', async () => {
    const userA = await signInNewUser('import-scope-a');
    const userB = await signInNewUser('import-scope-b');
    await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie: userA.cookie,
    });

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(JSON_ROW_LIST),
      cookie: userB.cookie,
    });
    const body = await readBody<ImportBody>(response);

    expect(body).toMatchObject({
      inserted: JSON_ROW_COUNT,
      skippedDuplicates: NO_ROWS,
      topLevelCategoriesCreated: JSON_TOP_LEVEL_COUNT,
      childCategoriesCreated: JSON_CHILD_COUNT,
    });
    expect(await countTransactions(userA.userId)).toBe(JSON_ROW_COUNT);
    expect(await countTransactions(userB.userId)).toBe(JSON_ROW_COUNT);
    expect(await countCategories(userA.userId)).toBe(JSON_TOP_LEVEL_COUNT + JSON_CHILD_COUNT);
    expect(await countCategories(userB.userId)).toBe(JSON_TOP_LEVEL_COUNT + JSON_CHILD_COUNT);
  });

  it('rejects a file with any invalid row using the shared envelope and writes nothing', async () => {
    const { cookie, userId } = await signInNewUser('import-invalid');
    const mixedRowList = [
      ...JSON_ROW_LIST,
      { ...JSON_ROW_LIST[0], Amount: 'abc' },
      { ...JSON_ROW_LIST[0], Type: 'Transfer' },
    ];

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.json',
      content: JSON.stringify(mixedRowList),
      cookie,
    });
    const body = await readBody<ErrorBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.BadRequest);
    expect(body.code).toBe(ErrorCode.ValidationError);
    expect(body.details?.rowErrorList).toEqual([
      expect.stringContaining('Row 5'),
      expect.stringContaining('Row 6'),
    ]);
    expect(await countTransactions(userId)).toBe(NO_ROWS);
    expect(await countCategories(userId)).toBe(NO_ROWS);
  });

  it('rejects an unsupported extension with the shared envelope', async () => {
    const { cookie } = await signInNewUser('import-ext');

    const response = await postImportFile({
      path: IMPORT_PATH,
      filename: 'import.txt',
      content: 'Date,Category',
      cookie,
    });
    const body = await readBody<ErrorBody>(response);

    expect(response.status).toBe(HTTP_STATUS_CODE.BadRequest);
    expect(body.code).toBe(ErrorCode.ValidationError);
    expect(body.message).toContain('Unsupported file format');
  });
});
