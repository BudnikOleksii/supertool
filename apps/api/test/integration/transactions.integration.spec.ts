import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PinoLogger } from 'nestjs-pino';
import type { StartedTestContainer } from 'testcontainers';

import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ErrorCode } from '@supertool/shared/constants/error-codes';
import { FIRST_PAGE } from '@supertool/shared/constants/pagination';
import type { TransactionSortOrder } from '@supertool/shared/constants/transaction-sort';
import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';

import type { TransactionType } from '../../src/database/schemas/enums.js';
import type { CreateTransactionDto } from '../../src/modules/transactions/dtos/create-transaction.dto.js';
import type { TransactionResponseDto } from '../../src/modules/transactions/dtos/transaction-response.dto.js';

import { parseEnv } from '../../src/app/env.schema.js';
import { generateId } from '../../src/database/generate-id.js';
import { transactionCategories } from '../../src/database/schemas/transaction-categories.js';
import { transactions } from '../../src/database/schemas/transactions.js';
import { users } from '../../src/database/schemas/users.js';
import { AnalyticsCacheService } from '../../src/modules/analytics/analytics-cache.service.js';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository.js';
import { TransactionsService } from '../../src/modules/transactions/transactions.service.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  MIGRATIONS_FOLDER,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const HIGH_LIMIT = 1000;
const SMALL_LIMIT = 5;
const SECOND_PAGE = FIRST_PAGE + 1;
const TWO_DIGITS = 2;
const FIRST_ROW_INDEX = 0;
const DEEP_SUBTREE_TRANSACTION_COUNT = 1;

const DEFAULT_SORT = { sortBy: DEFAULT_SORT_BY, sortOrder: DEFAULT_SORT_ORDER };

interface MonthWindow {
  dateFrom: string;
  dateTo: string;
}

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
  const pinoLoggerDouble = { logger: pino({ level: 'silent' }) } as unknown as PinoLogger;
  repository = new TransactionsRepository(database, pinoLoggerDouble);
  service = new TransactionsService(repository, new AnalyticsCacheService());
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  process.env.DATABASE_URL = databaseUrl;

  await loadSeedModules();
  connectDatabase(databaseUrl);

  await prepareDatabase({ databaseUrl, migrationsFolder: MIGRATIONS_FOLDER });
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
      ...DEFAULT_SORT,
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
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: SMALL_LIMIT,
    });
    const secondPage = await getRepository().findAllByUserId(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      ...DEFAULT_SORT,
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
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });
    const otherResult = await getRepository().findAllByUserId(userId, {
      ...DEFAULT_SORT,
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
      ...DEFAULT_SORT,
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
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    const actualRow = data.find((row) => row.id === childTransaction.id);
    expect(actualRow?.categoryName).toBe(childTransaction.childName);
    expect(actualRow?.categoryParentName).toBe(childTransaction.parentName);
  });
});

interface CategorySubtree {
  parentId: string;
  type: TransactionType;
  subtreeCount: number;
  idList: string[];
  childIdList: string[];
}

const countByType = async (type: TransactionType): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = $1 AND type = $2`,
    [operatorId, type],
  );
  return result.rows[0]?.count ?? 0;
};

const countSubtreeByType = async (idList: string[], type: TransactionType): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = $1 AND category_id = ANY($2) AND type = $3`,
    [operatorId, idList, type],
  );
  return result.rows[0]?.count ?? 0;
};

const loadLeafCategoryWithTransactions = async (): Promise<{ id: string; count: number }> => {
  const result = await getPool().query<{ id: string; count: number }>(
    `SELECT child.id, COUNT(t.id)::int AS count
     FROM transaction_categories child
     JOIN transactions t ON t.category_id = child.id AND t.user_id = child.user_id
     WHERE child.user_id = $1 AND child.parent_id IS NOT NULL
     GROUP BY child.id
     ORDER BY count DESC
     LIMIT 1`,
    [operatorId],
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('Seed produced no leaf category with transactions to test against');
  }
  return row;
};

const loadCategorySubtree = async (): Promise<CategorySubtree> => {
  const parentResult = await getPool().query<{ parentId: string; type: TransactionType }>(
    `SELECT parent.id AS "parentId", parent.type AS "type"
     FROM transaction_categories parent
     WHERE parent.user_id = $1 AND parent.parent_id IS NULL
       AND EXISTS (
         SELECT 1 FROM transactions t
         JOIN transaction_categories child ON child.id = t.category_id AND child.user_id = t.user_id
         WHERE t.user_id = $1 AND child.parent_id = parent.id
       )
     LIMIT 1`,
    [operatorId],
  );
  const [parent] = parentResult.rows;
  if (!parent) {
    throw new Error('Seed produced no parent category with child transactions to test against');
  }

  const idResult = await getPool().query<{ id: string }>(
    `SELECT id FROM transaction_categories WHERE user_id = $1 AND (id = $2 OR parent_id = $2)`,
    [operatorId, parent.parentId],
  );
  const idList = idResult.rows.map((row) => row.id);
  const childIdList = idList.filter((id) => id !== parent.parentId);

  const countResult = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = $1 AND category_id = ANY($2)`,
    [operatorId, idList],
  );

  return {
    parentId: parent.parentId,
    type: parent.type,
    subtreeCount: countResult.rows[0]?.count ?? 0,
    idList,
    childIdList,
  };
};

const insertDeepCategoryChain = async (): Promise<{
  userId: string;
  grandparentId: string;
  deepTransactionId: string;
}> => {
  const userId = generateId();
  const grandparentId = generateId();
  const parentId = generateId();
  const childId = generateId();
  const deepTransactionId = generateId();

  await getDatabase()
    .insert(users)
    .values({ id: userId, name: 'Deep User', email: `deep-${userId}@example.com` });
  await getDatabase()
    .insert(transactionCategories)
    .values([
      { id: grandparentId, userId, name: 'Deep Grandparent', type: 'expense' },
      { id: parentId, userId, name: 'Deep Parent', type: 'expense', parentId: grandparentId },
      { id: childId, userId, name: 'Deep Child', type: 'expense', parentId },
    ]);
  await getDatabase().insert(transactions).values({
    id: deepTransactionId,
    userId,
    categoryId: childId,
    type: 'expense',
    amount: '12.34',
    currency: 'UAH',
    date: '2025-01-15',
  });

  return { userId, grandparentId, deepTransactionId };
};

const checkAmountOrdered = (
  list: TransactionResponseDto[],
  sortOrder: TransactionSortOrder,
): boolean =>
  list.every((row, index) => {
    const previous = list[index - 1];
    if (previous === undefined) {
      return true;
    }
    const previousAmount = Number(previous.amount);
    const currentAmount = Number(row.amount);
    if (previousAmount !== currentAmount) {
      return sortOrder === 'asc'
        ? previousAmount <= currentAmount
        : previousAmount >= currentAmount;
    }
    return previous.id > row.id;
  });

const checkDateOrdered = (
  list: TransactionResponseDto[],
  sortOrder: TransactionSortOrder,
): boolean =>
  list.every((row, index) => {
    const previous = list[index - 1];
    if (previous === undefined) {
      return true;
    }
    if (previous.date !== row.date) {
      return sortOrder === 'asc' ? previous.date <= row.date : previous.date >= row.date;
    }
    return previous.id > row.id;
  });

describe('TransactionsRepository filters and sorting (Testcontainers Postgres)', () => {
  it('applies the type filter as an equality condition (AC1)', async () => {
    const expectedTotal = await countByType('expense');

    const { data, total } = await getRepository().findAllByUserId(operatorId, {
      type: 'expense',
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((row) => row.type === 'expense')).toBe(true);
    expect(total).toBe(expectedTotal);
  });

  it('filters by a leaf category id and matches the filtered total (AC1)', async () => {
    const leaf = await loadLeafCategoryWithTransactions();

    const { data, total } = await getRepository().findAllByUserId(operatorId, {
      categoryId: leaf.id,
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(data.length).toBeGreaterThan(0);
    expect(data.every((row) => row.categoryId === leaf.id)).toBe(true);
    expect(total).toBe(leaf.count);
  });

  it('includes descendant categories when filtering by a parent id (AC1)', async () => {
    const subtree = await loadCategorySubtree();

    const { data, total } = await getRepository().findAllByUserId(operatorId, {
      categoryId: subtree.parentId,
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(total).toBe(subtree.subtreeCount);
    expect(data.every((row) => subtree.idList.includes(row.categoryId))).toBe(true);
    expect(data.some((row) => subtree.childIdList.includes(row.categoryId))).toBe(true);
  });

  it('resolves multi-level descendants when filtering by an ancestor id (AC1)', async () => {
    const chain = await insertDeepCategoryChain();

    const { data, total } = await getRepository().findAllByUserId(chain.userId, {
      categoryId: chain.grandparentId,
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(total).toBe(DEEP_SUBTREE_TRANSACTION_COUNT);
    expect(data.some((row) => row.id === chain.deepTransactionId)).toBe(true);
  });

  it('honors a combined type and category filter (AC1)', async () => {
    const subtree = await loadCategorySubtree();
    const expectedTotal = await countSubtreeByType(subtree.idList, subtree.type);

    const { data, total } = await getRepository().findAllByUserId(operatorId, {
      type: subtree.type,
      categoryId: subtree.parentId,
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(total).toBe(expectedTotal);
    expect(data.every((row) => row.type === subtree.type)).toBe(true);
    expect(data.every((row) => subtree.idList.includes(row.categoryId))).toBe(true);
  });

  it('orders by numeric amount ascending and descending with a stable id tiebreaker (AC1)', async () => {
    const ascending = await getRepository().findAllByUserId(operatorId, {
      sortBy: 'amount',
      sortOrder: 'asc',
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });
    const descending = await getRepository().findAllByUserId(operatorId, {
      sortBy: 'amount',
      sortOrder: 'desc',
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(ascending.data.length).toBeGreaterThan(0);
    expect(checkAmountOrdered(ascending.data, 'asc')).toBe(true);
    expect(checkAmountOrdered(descending.data, 'desc')).toBe(true);
    expect(Number(ascending.data[FIRST_ROW_INDEX]?.amount)).toBeLessThanOrEqual(
      Number(descending.data[FIRST_ROW_INDEX]?.amount),
    );
  });

  it('reverses the default date order when sorting by date ascending (AC1)', async () => {
    const { data } = await getRepository().findAllByUserId(operatorId, {
      sortBy: 'date',
      sortOrder: 'asc',
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(data.length).toBeGreaterThan(0);
    expect(checkDateOrdered(data, 'asc')).toBe(true);
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

    const created = await getService().create(operatorId, {
      type: category.type,
      amount: input.amount,
      currency: 'UAH',
      categoryId: category.id,
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

const createOperatorTransaction = async (): Promise<TransactionResponseDto> => {
  const category = await loadOperatorChildCategory();

  return getService().create(operatorId, {
    type: category.type,
    amount: '10.00',
    currency: 'UAH',
    categoryId: category.id,
    date: '2025-04-10',
    note: 'before',
  });
};

const checkTransactionExists = async (id: string): Promise<boolean> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM transactions WHERE id = $1`,
    [id],
  );

  return (result.rows[0]?.count ?? 0) > 0;
};

describe('TransactionsService update/find-one/delete (Testcontainers Postgres)', () => {
  it('updates a user-scoped transaction and returns the new string amount (AC1)', async () => {
    const created = await createOperatorTransaction();
    const category = await loadOperatorChildCategory();

    const updated = await getService().update(operatorId, created.id, {
      type: category.type,
      amount: '77.77',
      currency: 'USD',
      categoryId: category.id,
      date: '2025-05-20',
      note: 'after',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.amount).toBe('77.77');
    expect(updated.currency).toBe('USD');
    expect(updated.date).toBe('2025-05-20');
    expect(updated.note).toBe('after');
    expect(typeof updated.amount).toBe('string');
  });

  it('returns a user-scoped transaction on find-one (AC2)', async () => {
    const created = await createOperatorTransaction();

    const found = await getService().findOne(operatorId, created.id);

    expect(found.id).toBe(created.id);
  });

  it('throws NotFoundException on find-one for a missing transaction (AC2)', async () => {
    await expect(getService().findOne(operatorId, generateId())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes a user-scoped transaction (AC3)', async () => {
    const created = await createOperatorTransaction();

    await getService().delete(operatorId, created.id);

    expect(await checkTransactionExists(created.id)).toBe(false);
    await expect(getService().findOne(operatorId, created.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('does not update another user transaction and surfaces not-found (FR21)', async () => {
    const window = await loadLatestMonthWindow();
    const { transactionId } = await insertSecondUserTransaction(window);
    const category = await loadOperatorChildCategory();

    await expect(
      getService().update(operatorId, transactionId, {
        type: category.type,
        amount: '5.00',
        currency: 'UAH',
        categoryId: category.id,
        date: '2025-05-20',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const storedRow = await loadStoredTransaction(transactionId);
    expect(storedRow?.amount).toBe('99.99');
  });

  it('does not delete another user transaction and surfaces not-found (FR21)', async () => {
    const window = await loadLatestMonthWindow();
    const { transactionId } = await insertSecondUserTransaction(window);

    await expect(getService().delete(operatorId, transactionId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await checkTransactionExists(transactionId)).toBe(true);
  });
});

const BULK_TRANSACTION_COUNT = 3;
const SINGLE_TRANSACTION_COUNT = 1;
const ZERO_DELETED_COUNT = 0;

const createOperatorTransactionList = (size: number): Promise<TransactionResponseDto[]> =>
  Promise.all(Array.from({ length: size }, () => createOperatorTransaction()));

const checkNoneExist = async (idList: string[]): Promise<boolean> => {
  const existsList = await Promise.all(idList.map((id) => checkTransactionExists(id)));
  return existsList.every((exists) => !exists);
};

describe('TransactionsService bulkDelete (Testcontainers Postgres)', () => {
  it('deletes a multi-id set in one batch and returns the count (AC2)', async () => {
    const createdList = await createOperatorTransactionList(BULK_TRANSACTION_COUNT);
    const idList = createdList.map((transaction) => transaction.id);

    const result = await getService().bulkDelete(operatorId, idList);

    expect(result.deletedCount).toBe(BULK_TRANSACTION_COUNT);
    expect(result.failedList).toEqual([]);
    expect(await checkNoneExist(idList)).toBe(true);
  });

  it('reports nonexistent ids as failures while deleting the valid ones (AC4)', async () => {
    const createdList = await createOperatorTransactionList(BULK_TRANSACTION_COUNT);
    const validIdList = createdList.map((transaction) => transaction.id);
    const missingId = generateId();

    const result = await getService().bulkDelete(operatorId, [...validIdList, missingId]);

    expect(result.deletedCount).toBe(BULK_TRANSACTION_COUNT);
    expect(result.failedList).toEqual([{ id: missingId, reason: ErrorCode.NotFound }]);
    expect(await checkNoneExist(validIdList)).toBe(true);
  });

  it('never deletes another user rows and reports them as failed (FR21)', async () => {
    const window = await loadLatestMonthWindow();
    const { transactionId } = await insertSecondUserTransaction(window);
    const own = await createOperatorTransaction();

    const result = await getService().bulkDelete(operatorId, [own.id, transactionId]);

    expect(result.deletedCount).toBe(SINGLE_TRANSACTION_COUNT);
    expect(result.failedList).toEqual([{ id: transactionId, reason: ErrorCode.NotFound }]);
    expect(await checkTransactionExists(transactionId)).toBe(true);
    expect(await checkTransactionExists(own.id)).toBe(false);
  });

  it('is idempotent: re-deleting already-deleted ids reports all failed with zero count (AC4)', async () => {
    const created = await createOperatorTransaction();

    const firstResult = await getService().bulkDelete(operatorId, [created.id]);
    const secondResult = await getService().bulkDelete(operatorId, [created.id]);

    expect(firstResult.deletedCount).toBe(SINGLE_TRANSACTION_COUNT);
    expect(secondResult.deletedCount).toBe(ZERO_DELETED_COUNT);
    expect(secondResult.failedList).toEqual([{ id: created.id, reason: ErrorCode.NotFound }]);
  });
});

const SEARCH_WINDOW: MonthWindow = { dateFrom: '2025-06-01', dateTo: '2025-06-30' };
const SEARCH_DATE = '2025-06-15';
const SEARCH_AMOUNT = '10.00';

const createOperatorNoteTransaction = async (note: string): Promise<TransactionResponseDto> => {
  const category = await loadOperatorChildCategory();

  return getService().create(operatorId, {
    type: category.type,
    amount: SEARCH_AMOUNT,
    currency: 'UAH',
    categoryId: category.id,
    date: SEARCH_DATE,
    note,
  });
};

const insertSecondUserNoteTransaction = async (
  note: string,
): Promise<{ userId: string; transactionId: string }> => {
  const userId = generateId();
  const categoryId = generateId();
  const transactionId = generateId();

  await getDatabase()
    .insert(users)
    .values({ id: userId, name: 'Search User', email: `search-${userId}@example.com` });
  await getDatabase()
    .insert(transactionCategories)
    .values({ id: categoryId, userId, name: 'Search Category', type: 'expense' });
  await getDatabase().insert(transactions).values({
    id: transactionId,
    userId,
    categoryId,
    type: 'expense',
    amount: SEARCH_AMOUNT,
    currency: 'UAH',
    date: SEARCH_DATE,
    note,
  });

  return { userId, transactionId };
};

const searchOperatorWindow = (
  search: string,
  overrides: Partial<FindAllByUserIdQueryShape> = {},
): Promise<FindAllByUserIdResultShape> =>
  getRepository().findAllByUserId(operatorId, {
    dateFrom: SEARCH_WINDOW.dateFrom,
    dateTo: SEARCH_WINDOW.dateTo,
    search,
    ...DEFAULT_SORT,
    page: FIRST_PAGE,
    limit: HIGH_LIMIT,
    ...overrides,
  });

interface FindAllByUserIdQueryShape {
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType;
  categoryId?: string;
  search?: string;
  sortBy: typeof DEFAULT_SORT_BY;
  sortOrder: TransactionSortOrder;
  page: number;
  limit: number;
}

interface FindAllByUserIdResultShape {
  data: TransactionResponseDto[];
  total: number;
}

const SEARCH_SEEDED_ROW_COUNT = 8;
const SEARCH_COFFEE_MATCH_COUNT = 2;
const SEARCH_SINGLE_MATCH = 1;
const SEARCH_NO_MATCH = 0;
const SEARCH_PAGE_LIMIT_ONE = 1;
const NONCE_SLICE_START = 0;
const NONCE_HEX_LENGTH = 10;

let searchNonce = '';

describe('TransactionsRepository search (Testcontainers Postgres)', () => {
  beforeAll(async () => {
    searchNonce = `mk${generateId().replaceAll('-', '').slice(NONCE_SLICE_START, NONCE_HEX_LENGTH)}`;

    await createOperatorNoteTransaction(`${searchNonce}coffee-one`);
    await createOperatorNoteTransaction(`${searchNonce}coffee-two`);
    await createOperatorNoteTransaction(`${searchNonce}50%off`);
    await createOperatorNoteTransaction(`${searchNonce}5000off`);
    await createOperatorNoteTransaction(`${searchNonce}a_b`);
    await createOperatorNoteTransaction(`${searchNonce}axb`);
    await createOperatorNoteTransaction(`${searchNonce}Кава`);
    await createOperatorNoteTransaction(`${searchNonce}'; DROP TABLE transactions;--`);
  }, BOOT_TIMEOUT_MS);

  it('matches all seeded rows for the unique nonce within the period (AC1)', async () => {
    const { data, total } = await searchOperatorWindow(searchNonce);

    expect(total).toBe(SEARCH_SEEDED_ROW_COUNT);
    expect(data.every((row) => row.note.includes(searchNonce))).toBe(true);
  });

  it('matches the note case-insensitively (AC2/AC3)', async () => {
    const { data, total } = await searchOperatorWindow(`${searchNonce}COFFEE`);

    expect(total).toBe(SEARCH_COFFEE_MATCH_COUNT);
    expect(data.every((row) => row.note.toLowerCase().includes('coffee'))).toBe(true);
  });

  it('treats LIKE metacharacters as literals, not wildcards (AC3)', async () => {
    const percentResult = await searchOperatorWindow(`${searchNonce}50%`);
    const underscoreResult = await searchOperatorWindow(`${searchNonce}a_b`);

    expect(percentResult.total).toBe(SEARCH_SINGLE_MATCH);
    expect(percentResult.data[FIRST_ROW_INDEX]?.note).toContain('50%off');
    expect(underscoreResult.total).toBe(SEARCH_SINGLE_MATCH);
    expect(underscoreResult.data[FIRST_ROW_INDEX]?.note).toContain('a_b');
  });

  it('matches Cyrillic note text case-insensitively (AC3)', async () => {
    const { data, total } = await searchOperatorWindow(`${searchNonce}кава`);

    expect(total).toBe(SEARCH_SINGLE_MATCH);
    expect(data[FIRST_ROW_INDEX]?.note).toContain('Кава');
  });

  it('treats a SQL-injection payload as inert literal text (AC3)', async () => {
    const { data, total } = await searchOperatorWindow(
      `${searchNonce}'; DROP TABLE transactions;--`,
    );

    expect(total).toBe(SEARCH_SINGLE_MATCH);
    expect(data[FIRST_ROW_INDEX]?.note).toContain('DROP TABLE');

    const stillPresent = await searchOperatorWindow(searchNonce);
    expect(stillPresent.total).toBe(SEARCH_SEEDED_ROW_COUNT);
  });

  it('returns an empty result with a correct total for a non-matching query (AC10)', async () => {
    const { data, total } = await searchOperatorWindow(`${searchNonce}no-such-token`);

    expect(data).toEqual([]);
    expect(total).toBe(SEARCH_NO_MATCH);
  });

  it('ignores a whitespace-only search and returns the unfiltered period view (AC1)', async () => {
    const searched = await searchOperatorWindow('   ');
    const unfiltered = await searchOperatorWindow('');

    expect(searched.total).toBe(unfiltered.total);
    expect(searched.total).toBeGreaterThanOrEqual(SEARCH_SEEDED_ROW_COUNT);
  });

  it('composes search with the type filter and offset pagination (AC1)', async () => {
    const category = await loadOperatorChildCategory();

    const matchingType = await searchOperatorWindow(searchNonce, { type: category.type });
    const oppositeType = await searchOperatorWindow(searchNonce, {
      type: getOppositeType(category.type),
    });
    const firstPage = await searchOperatorWindow(`${searchNonce}coffee`, {
      limit: SEARCH_PAGE_LIMIT_ONE,
    });

    expect(matchingType.total).toBe(SEARCH_SEEDED_ROW_COUNT);
    expect(oppositeType.total).toBe(SEARCH_NO_MATCH);
    expect(firstPage.data.length).toBe(SEARCH_PAGE_LIMIT_ONE);
    expect(firstPage.total).toBe(SEARCH_COFFEE_MATCH_COUNT);
  });

  it('never returns another user rows for a matching search (FR21)', async () => {
    const { userId, transactionId } = await insertSecondUserNoteTransaction(
      `${searchNonce}coffee-other`,
    );

    const operatorResult = await searchOperatorWindow(`${searchNonce}coffee`);
    const otherResult = await getRepository().findAllByUserId(userId, {
      dateFrom: SEARCH_WINDOW.dateFrom,
      dateTo: SEARCH_WINDOW.dateTo,
      search: `${searchNonce}coffee`,
      ...DEFAULT_SORT,
      page: FIRST_PAGE,
      limit: HIGH_LIMIT,
    });

    expect(operatorResult.data.some((row) => row.id === transactionId)).toBe(false);
    expect(otherResult.data.map((row) => row.id)).toEqual([transactionId]);
  });
});

describe('pg_trgm migration (Testcontainers Postgres)', () => {
  it('installs the pg_trgm extension via migration 0006 (AC4)', async () => {
    const result = await getPool().query<{ extname: string }>(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`,
    );

    expect(result.rows).toHaveLength(1);
  });

  it('creates the GIN trigram index on the note column (AC4)', async () => {
    const result = await getPool().query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'transactions_note_trgm_idx'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[FIRST_ROW_INDEX]?.indexdef).toContain('gin');
    expect(result.rows[FIRST_ROW_INDEX]?.indexdef).toContain('gin_trgm_ops');
  });
});
