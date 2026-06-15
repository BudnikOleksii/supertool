import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { StartedTestContainer } from 'testcontainers';

import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TransactionType } from '../../src/database/schemas/enums.js';
import type { CreateTransactionDto } from '../../src/modules/transactions/dtos/create-transaction.dto.js';
import type { TransactionResponseDto } from '../../src/modules/transactions/dtos/transaction-response.dto.js';

import { parseEnv } from '../../src/app/env.schema.js';
import { generateId } from '../../src/database/generate-id.js';
import { transactionCategories } from '../../src/database/schemas/transaction-categories.js';
import { transactions } from '../../src/database/schemas/transactions.js';
import { users } from '../../src/database/schemas/users.js';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository.js';
import { TransactionsService } from '../../src/modules/transactions/transactions.service.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const POSTGRES_PORT = 5432;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;
const HIGH_LIMIT = 1000;
const SMALL_LIMIT = 5;
const FIRST_PAGE = 1;
const SECOND_PAGE = 2;
const TWO_DIGITS = 2;

interface MonthWindow {
  dateFrom: string;
  dateTo: string;
}

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let authDatabasePool: Pool | undefined = undefined;
let database: NodePgDatabase | undefined = undefined;
let repository: TransactionsRepository | undefined = undefined;
let service: TransactionsService | undefined = undefined;
let operatorId = '';

const moduleNotLoaded = (): Promise<void> => Promise.reject(new Error('module not loaded'));
let prepareDatabase: (options: { databaseUrl: string; migrationsFolder: string }) => Promise<void> =
  moduleNotLoaded;
let runSeed: (options: { databaseUrl: string }) => Promise<void> = moduleNotLoaded;

const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Postgres pool is not initialised');
  }
  return pool;
};

const getRepository = (): TransactionsRepository => {
  if (!repository) {
    throw new Error('Repository is not initialised');
  }
  return repository;
};

const getService = (): TransactionsService => {
  if (!service) {
    throw new Error('Service is not initialised');
  }
  return service;
};

const getOppositeType = (type: TransactionType): TransactionType =>
  type === 'expense' ? 'income' : 'expense';

const getDatabase = (): NodePgDatabase => {
  if (!database) {
    throw new Error('Database is not initialised');
  }
  return database;
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

const padTwoDigits = (value: number): string => String(value).padStart(TWO_DIGITS, '0');

const getMonthWindow = (isoDate: string): MonthWindow => {
  const [yearPart, monthPart] = isoDate.split('-');
  const lastDay = new Date(Number(yearPart), Number(monthPart), 0).getDate();

  return {
    dateFrom: `${yearPart}-${monthPart}-01`,
    dateTo: `${yearPart}-${monthPart}-${padTwoDigits(lastDay)}`,
  };
};

const loadOperatorId = async (email: string): Promise<string> => {
  const result = await getPool().query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [
    email,
  ]);
  const [operator] = result.rows;
  if (!operator) {
    throw new Error('Operator account was not created by the seed');
  }
  return operator.id;
};

const loadLatestMonthWindow = async (): Promise<MonthWindow> => {
  const result = await getPool().query<{ date: string }>(
    `SELECT date::text AS date FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
    [operatorId],
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('Seed produced no transactions to test against');
  }
  return getMonthWindow(row.date);
};

const countWindowRows = async (window: MonthWindow): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [operatorId, window.dateFrom, window.dateTo],
  );
  return result.rows[0]?.count ?? 0;
};

const loadChildCategoryTransaction = async (): Promise<{
  id: string;
  date: string;
  childName: string;
  parentName: string;
}> => {
  const result = await getPool().query<{
    id: string;
    date: string;
    childName: string;
    parentName: string;
  }>(
    `SELECT t.id, t.date::text AS date, child.name AS "childName", parent.name AS "parentName"
     FROM transactions t
     JOIN transaction_categories child ON child.id = t.category_id AND child.user_id = t.user_id
     JOIN transaction_categories parent ON parent.id = child.parent_id
     WHERE t.user_id = $1
     LIMIT 1`,
    [operatorId],
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('Seed produced no child-category transaction to test against');
  }
  return row;
};

const loadOperatorChildCategory = async (): Promise<{
  id: string;
  type: TransactionType;
  name: string;
  parentName: string;
}> => {
  const result = await getPool().query<{
    id: string;
    type: TransactionType;
    name: string;
    parentName: string;
  }>(
    `SELECT child.id, child.type, child.name, parent.name AS "parentName"
     FROM transaction_categories child
     JOIN transaction_categories parent ON parent.id = child.parent_id
     WHERE child.user_id = $1
     LIMIT 1`,
    [operatorId],
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('Seed produced no operator child category to test against');
  }
  return row;
};

const insertSecondUserCategory = async (): Promise<{ userId: string; categoryId: string }> => {
  const userId = generateId();
  const categoryId = generateId();

  await getDatabase()
    .insert(users)
    .values({ id: userId, name: 'Second User', email: `second-${userId}@example.com` });
  await getDatabase()
    .insert(transactionCategories)
    .values({ id: categoryId, userId, name: 'Other Category', type: 'expense' });

  return { userId, categoryId };
};

const insertSecondUserTransaction = async (
  window: MonthWindow,
): Promise<{ userId: string; transactionId: string }> => {
  const userId = generateId();
  const categoryId = generateId();
  const transactionId = generateId();

  await getDatabase()
    .insert(users)
    .values({ id: userId, name: 'Second User', email: `second-${userId}@example.com` });
  await getDatabase()
    .insert(transactionCategories)
    .values({ id: categoryId, userId, name: 'Other Category', type: 'expense' });
  await getDatabase().insert(transactions).values({
    id: transactionId,
    userId,
    categoryId,
    type: 'expense',
    amount: '99.99',
    currency: 'UAH',
    date: window.dateFrom,
  });

  return { userId, transactionId };
};

const checkRowsWithinWindow = (data: TransactionResponseDto[], window: MonthWindow): boolean =>
  data.every((row) => row.date >= window.dateFrom && row.date <= window.dateTo);

const checkListIsStablyOrdered = (list: TransactionResponseDto[]): boolean =>
  list.every((row, index) => {
    const previous = list[index - 1];
    if (previous === undefined) {
      return true;
    }
    return previous.date > row.date || (previous.date === row.date && previous.id > row.id);
  });

const loadSeedModules = async (): Promise<void> => {
  ({ prepareDatabase } = await import('../../src/database/prepare-database.js'));
  ({ runSeed } = await import('../../src/database/run-seed.js'));
  ({ authDatabasePool } = await import('../../src/auth/auth.js'));
};

const connectDatabase = (databaseUrl: string): void => {
  pool = new Pool({ connectionString: databaseUrl });
  database = drizzle(pool);
  repository = new TransactionsRepository(database);
  service = new TransactionsService(repository);
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;
  process.env.DATABASE_URL = databaseUrl;

  await loadSeedModules();
  connectDatabase(databaseUrl);

  await prepareDatabase({ databaseUrl, migrationsFolder });
  await runSeed({ databaseUrl });

  operatorId = await loadOperatorId(parseEnv().SEED_OPERATOR_EMAIL);
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await pool?.end();
  await authDatabasePool?.end();
  await container?.stop();
});

describe('TransactionsRepository (Testcontainers Postgres)', () => {
  it('windows rows to the requested month and excludes adjacent months (AC1)', async () => {
    const window = await loadLatestMonthWindow();

    const { data, total } = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(data.length).toBeGreaterThan(0);
    expect(checkRowsWithinWindow(data, window)).toBe(true);
    expect(total).toBe(await countWindowRows(window));
  });

  it('respects limit and returns disjoint, stably-ordered pages (AC1)', async () => {
    const window = await loadLatestMonthWindow();

    const firstPage = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      page: FIRST_PAGE,
      limit: SMALL_LIMIT,
    });
    const secondPage = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      page: SECOND_PAGE,
      limit: SMALL_LIMIT,
    });

    const firstIdSet = new Set(firstPage.data.map((row) => row.id));
    const overlap = secondPage.data.filter((row) => firstIdSet.has(row.id));

    expect(firstPage.data.length).toBeLessThanOrEqual(SMALL_LIMIT);
    expect(overlap).toEqual([]);
    expect(checkListIsStablyOrdered([...firstPage.data, ...secondPage.data])).toBe(true);
  });

  it('never returns another user rows for the operator (FR21)', async () => {
    const window = await loadLatestMonthWindow();
    const { userId, transactionId } = await insertSecondUserTransaction(window);

    const operatorResult = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });
    const otherResult = await getRepository().findAllByUserId(userId, {
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(operatorResult.data.some((row) => row.id === transactionId)).toBe(false);
    expect(otherResult.data.map((row) => row.id)).toEqual([transactionId]);
  });

  it('returns amounts as strings (D1)', async () => {
    const window = await loadLatestMonthWindow();

    const { data } = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      page: FIRST_PAGE,
      limit: SMALL_LIMIT,
    });

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((row) => typeof row.amount === 'string')).toBe(true);
  });

  it('resolves category name and parent name for a child-category transaction (AC2)', async () => {
    const childTransaction = await loadChildCategoryTransaction();

    const { data } = await getRepository().findAllByUserId(operatorId, {
      dateFrom: childTransaction.date,
      dateTo: childTransaction.date,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    const actualRow = data.find((row) => row.id === childTransaction.id);
    expect(actualRow?.categoryName).toBe(childTransaction.childName);
    expect(actualRow?.categoryParentName).toBe(childTransaction.parentName);
  });
});

const loadStoredTransaction = async (
  id: string,
): Promise<{ importKey: string | null; amount: string; userId: string } | undefined> => {
  const result = await getPool().query<{
    importKey: string | null;
    amount: string;
    userId: string;
  }>(
    `SELECT import_key AS "importKey", amount, user_id AS "userId" FROM transactions WHERE id = $1`,
    [id],
  );

  return result.rows[0];
};

describe('TransactionsService create (Testcontainers Postgres)', () => {
  it('inserts a user-scoped row with NULL import_key and the exact string amount (AC1)', async () => {
    const category = await loadOperatorChildCategory();
    const input = { amount: '12.34', date: '2025-03-15', note: 'Integration note' };

    const created = await getRepository().create({
      userId: operatorId,
      categoryId: category.id,
      type: category.type,
      amount: input.amount,
      currency: 'UAH',
      date: input.date,
      note: input.note,
    });

    expect(created.amount).toBe(input.amount);
    expect(created.categoryName).toBe(category.name);
    expect(created.categoryParentName).toBe(category.parentName);
    expect(created.note).toBe(input.note);

    const storedRow = await loadStoredTransaction(created.id);
    expect(storedRow).toEqual({ importKey: null, amount: input.amount, userId: operatorId });
  });

  it('rejects creating a transaction against another user category (FR21)', async () => {
    const { categoryId } = await insertSecondUserCategory();
    const inputDto: CreateTransactionDto = {
      type: 'expense',
      amount: '50.00',
      currency: 'UAH',
      categoryId,
      date: '2025-03-15',
    };

    await expect(getService().create(operatorId, inputDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects creating a transaction whose type differs from the category type (AC2)', async () => {
    const category = await loadOperatorChildCategory();
    const inputDto: CreateTransactionDto = {
      type: getOppositeType(category.type),
      amount: '50.00',
      currency: 'UAH',
      categoryId: category.id,
      date: '2025-03-15',
    };

    await expect(getService().create(operatorId, inputDto)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });
});
