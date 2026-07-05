import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { StartedTestContainer } from 'testcontainers';

import Decimal from 'decimal.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/app/env.schema.js';
import { generateId } from '../../src/database/generate-id.js';
import { AnalyticsCacheService } from '../../src/modules/analytics/analytics-cache.service.js';
import { AnalyticsRepository } from '../../src/modules/analytics/analytics.repository.js';
import { AnalyticsService } from '../../src/modules/analytics/analytics.service.js';
import { UsersRepository } from '../../src/modules/users/users.repository.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  MIGRATIONS_FOLDER,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const MONEY_SCALE = 2;
const TWO_DIGITS = 2;
const SEED_CURRENCY = 'UAH';
const FOREIGN_CURRENCY = 'USD';
const EMPTY_MONTH = { dateFrom: '1900-01-01', dateTo: '1900-01-31' };
const OTHER_USER_EXPENSE = '777.77';

interface MonthWindow {
  dateFrom: string;
  dateTo: string;
}

interface ExpectedSummary {
  income: string;
  expense: string;
  net: string;
}

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let authDatabasePool: Pool | undefined = undefined;
let database: NodePgDatabase | undefined = undefined;
let analyticsRepository: AnalyticsRepository | undefined = undefined;
let analyticsService: AnalyticsService | undefined = undefined;
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

const getAnalyticsRepository = (): AnalyticsRepository => {
  if (!analyticsRepository) {
    throw new Error('Analytics repository is not initialised');
  }
  return analyticsRepository;
};

const getAnalyticsService = (): AnalyticsService => {
  if (!analyticsService) {
    throw new Error('Analytics service is not initialised');
  }
  return analyticsService;
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

const loadOperator = async (
  email: string,
): Promise<{ id: string; defaultCurrency: string | null }> => {
  const result = await getPool().query<{ id: string; defaultCurrency: string | null }>(
    `SELECT id, default_currency AS "defaultCurrency" FROM users WHERE email = $1`,
    [email],
  );
  const [operator] = result.rows;
  if (!operator) {
    throw new Error('Operator account was not created by the seed');
  }
  return operator;
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

const loadExpectedSummary = async (
  window: MonthWindow,
  currency: string,
): Promise<ExpectedSummary> => {
  const result = await getPool().query<{ type: string; amount: string }>(
    `SELECT type::text AS type, amount::text AS amount
     FROM transactions
     WHERE user_id = $1 AND currency = $2 AND date >= $3 AND date <= $4`,
    [operatorId, currency, window.dateFrom, window.dateTo],
  );

  const income = result.rows
    .filter((row) => row.type === 'income')
    .reduce((total, row) => total.plus(new Decimal(row.amount)), new Decimal(0));
  const expense = result.rows
    .filter((row) => row.type === 'expense')
    .reduce((total, row) => total.plus(new Decimal(row.amount)), new Decimal(0));

  return {
    income: income.toFixed(MONEY_SCALE),
    expense: expense.toFixed(MONEY_SCALE),
    net: income.minus(expense).toFixed(MONEY_SCALE),
  };
};

const loadOperatorCategoryId = async (): Promise<string> => {
  const result = await getPool().query<{ id: string }>(
    `SELECT id FROM transaction_categories WHERE user_id = $1 LIMIT 1`,
    [operatorId],
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error('Seed produced no operator category to test against');
  }
  return row.id;
};

const insertOtherUserWithTransaction = async (window: MonthWindow): Promise<string> => {
  const otherUserId = generateId();
  const otherCategoryId = generateId();

  await getPool().query(
    `INSERT INTO users (id, name, email, default_currency) VALUES ($1, $2, $3, $4)`,
    [otherUserId, 'Other User', `other-${otherUserId}@example.com`, SEED_CURRENCY],
  );
  await getPool().query(
    `INSERT INTO transaction_categories (id, user_id, name, type) VALUES ($1, $2, 'Other', 'expense')`,
    [otherCategoryId, otherUserId],
  );
  await getPool().query(
    `INSERT INTO transactions (id, user_id, category_id, type, amount, currency, date, note)
     VALUES ($1, $2, $3, 'expense', $4, $5, $6, '')`,
    [
      generateId(),
      otherUserId,
      otherCategoryId,
      OTHER_USER_EXPENSE,
      SEED_CURRENCY,
      window.dateFrom,
    ],
  );

  return otherUserId;
};

const BREAKDOWN_WINDOW = { dateFrom: '2099-03-01', dateTo: '2099-03-31' };
const BREAKDOWN_DATE = '2099-03-15';
const FOOD_ROOT_TOTAL = '60.00';
const TRANSPORT_ROOT_TOTAL = '100.00';
const BREAKDOWN_TOTAL_EXPENSE = '160.00';
const FOOD_SHARE = 37.5;
const TRANSPORT_SHARE = 62.5;
const EXPECTED_BREAKDOWN_ROW_COUNT = 2;

interface BreakdownFixture {
  userId: string;
  foodRootId: string;
  transportRootId: string;
}

const insertExpenseCategory = async (params: {
  userId: string;
  name: string;
  parentId: string | null;
}): Promise<string> => {
  const id = generateId();
  await getPool().query(
    `INSERT INTO transaction_categories (id, user_id, name, type, parent_id) VALUES ($1, $2, $3, 'expense', $4)`,
    [id, params.userId, params.name, params.parentId],
  );
  return id;
};

const insertTransaction = async (params: {
  userId: string;
  categoryId: string;
  amount: string;
  currency: string;
  type: string;
}): Promise<void> => {
  await getPool().query(
    `INSERT INTO transactions (id, user_id, category_id, type, amount, currency, date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '')`,
    [
      generateId(),
      params.userId,
      params.categoryId,
      params.type,
      params.amount,
      params.currency,
      BREAKDOWN_DATE,
    ],
  );
};

const insertUser = async (name: string): Promise<string> => {
  const userId = generateId();
  await getPool().query(
    `INSERT INTO users (id, name, email, default_currency) VALUES ($1, $2, $3, $4)`,
    [
      userId,
      name,
      `${name.replace(/\s+/gu, '-').toLowerCase()}-${userId}@example.com`,
      SEED_CURRENCY,
    ],
  );
  return userId;
};

interface BreakdownHierarchy {
  foodRootId: string;
  restaurantsId: string;
  fastFoodId: string;
  transportRootId: string;
}

const insertBreakdownHierarchy = async (userId: string): Promise<BreakdownHierarchy> => {
  const foodRootId = await insertExpenseCategory({ userId, name: 'Food', parentId: null });
  const restaurantsId = await insertExpenseCategory({
    userId,
    name: 'Restaurants',
    parentId: foodRootId,
  });
  const fastFoodId = await insertExpenseCategory({
    userId,
    name: 'Fast Food',
    parentId: restaurantsId,
  });
  const transportRootId = await insertExpenseCategory({
    userId,
    name: 'Transport',
    parentId: null,
  });

  return { foodRootId, restaurantsId, fastFoodId, transportRootId };
};

const insertBreakdownTransactions = async (
  userId: string,
  hierarchy: BreakdownHierarchy,
): Promise<void> => {
  const transactionList = [
    { categoryId: hierarchy.foodRootId, amount: '10.00', currency: SEED_CURRENCY, type: 'expense' },
    {
      categoryId: hierarchy.restaurantsId,
      amount: '20.00',
      currency: SEED_CURRENCY,
      type: 'expense',
    },
    { categoryId: hierarchy.fastFoodId, amount: '30.00', currency: SEED_CURRENCY, type: 'expense' },
    {
      categoryId: hierarchy.transportRootId,
      amount: '100.00',
      currency: SEED_CURRENCY,
      type: 'expense',
    },
    { categoryId: hierarchy.foodRootId, amount: '500.00', currency: SEED_CURRENCY, type: 'income' },
    {
      categoryId: hierarchy.foodRootId,
      amount: '999.99',
      currency: FOREIGN_CURRENCY,
      type: 'expense',
    },
  ];

  await Promise.all(transactionList.map((entry) => insertTransaction({ userId, ...entry })));
};

const insertCrossUserExpense = async (): Promise<void> => {
  const otherUserId = await insertUser('Other Breakdown User');
  const otherCategoryId = generateId();
  await getPool().query(
    `INSERT INTO transaction_categories (id, user_id, name, type) VALUES ($1, $2, 'Other', 'expense')`,
    [otherCategoryId, otherUserId],
  );
  await insertTransaction({
    userId: otherUserId,
    categoryId: otherCategoryId,
    amount: '321.00',
    currency: SEED_CURRENCY,
    type: 'expense',
  });
};

const seedBreakdownFixture = async (): Promise<BreakdownFixture> => {
  const userId = await insertUser('Breakdown User');
  const hierarchy = await insertBreakdownHierarchy(userId);

  await insertBreakdownTransactions(userId, hierarchy);
  await insertCrossUserExpense();

  return {
    userId,
    foodRootId: hierarchy.foodRootId,
    transportRootId: hierarchy.transportRootId,
  };
};

const loadSeedModules = async (): Promise<void> => {
  ({ prepareDatabase } = await import('../../src/database/prepare-database.js'));
  ({ runSeed } = await import('../../src/database/run-seed.js'));
  ({ authDatabasePool } = await import('../../src/auth/auth.js'));
};

const connectDatabase = (databaseUrl: string): void => {
  pool = new Pool({ connectionString: databaseUrl });
  database = drizzle(pool);
  analyticsRepository = new AnalyticsRepository(database);
  analyticsService = new AnalyticsService(
    analyticsRepository,
    new UsersRepository(database),
    new AnalyticsCacheService(),
  );
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  process.env.DATABASE_URL = databaseUrl;

  await loadSeedModules();
  connectDatabase(databaseUrl);

  await prepareDatabase({ databaseUrl, migrationsFolder: MIGRATIONS_FOLDER });
  await runSeed({ databaseUrl });

  const operator = await loadOperator(parseEnv().SEED_OPERATOR_EMAIL);
  operatorId = operator.id;
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await pool?.end();
  await authDatabasePool?.end();
  await container?.stop();
});

describe('AnalyticsRepository monthly summary (Testcontainers Postgres)', () => {
  it('computes income, expense and net matching independently summed seed totals (AC1, AC4, FR18)', async () => {
    const window = await loadLatestMonthWindow();
    const expected = await loadExpectedSummary(window, SEED_CURRENCY);

    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: operatorId,
      currency: SEED_CURRENCY,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    expect(summary.income).toBe(expected.income);
    expect(summary.expense).toBe(expected.expense);
    expect(summary.net).toBe(expected.net);
    expect(summary.currency).toBe(SEED_CURRENCY);
    expect(typeof summary.income).toBe('string');
  });

  it('keeps net exactly equal to income minus expense (D1, FR18)', async () => {
    const window = await loadLatestMonthWindow();

    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: operatorId,
      currency: SEED_CURRENCY,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    const expectedNet = new Decimal(summary.income).minus(new Decimal(summary.expense));
    expect(summary.net).toBe(expectedNet.toFixed(MONEY_SCALE));
  });

  it('returns zero figures for a month with no transactions (AC2 empty-month boundary)', async () => {
    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: operatorId,
      currency: SEED_CURRENCY,
      dateFrom: EMPTY_MONTH.dateFrom,
      dateTo: EMPTY_MONTH.dateTo,
    });

    expect(summary).toEqual({
      income: '0.00',
      expense: '0.00',
      net: '0.00',
      currency: SEED_CURRENCY,
    });
  });

  it('excludes other-currency transactions from the default-currency summary (no cross-currency aggregation)', async () => {
    const window = await loadLatestMonthWindow();
    const expected = await loadExpectedSummary(window, SEED_CURRENCY);
    const categoryId = await loadOperatorCategoryId();

    await getPool().query(
      `INSERT INTO transactions (id, user_id, category_id, type, amount, currency, date, note)
       VALUES ($1, $2, $3, 'expense', '999.99', $4, $5, '')`,
      [generateId(), operatorId, categoryId, FOREIGN_CURRENCY, window.dateFrom],
    );

    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: operatorId,
      currency: SEED_CURRENCY,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    expect(summary.income).toBe(expected.income);
    expect(summary.expense).toBe(expected.expense);
    expect(summary.net).toBe(expected.net);
  });

  it("excludes another user's same-currency transactions from the summary (user scoping)", async () => {
    const window = await loadLatestMonthWindow();
    const expected = await loadExpectedSummary(window, SEED_CURRENCY);
    const otherUserId = await insertOtherUserWithTransaction(window);

    const operatorSummary = await getAnalyticsRepository().getMonthlySummary({
      userId: operatorId,
      currency: SEED_CURRENCY,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    const otherUserSummary = await getAnalyticsRepository().getMonthlySummary({
      userId: otherUserId,
      currency: SEED_CURRENCY,
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    expect(operatorSummary.income).toBe(expected.income);
    expect(operatorSummary.expense).toBe(expected.expense);
    expect(operatorSummary.net).toBe(expected.net);
    expect(otherUserSummary.expense).toBe(OTHER_USER_EXPENSE);
    expect(otherUserSummary.net).toBe(`-${OTHER_USER_EXPENSE}`);
  });
});

describe('AnalyticsService monthly summary (Testcontainers Postgres)', () => {
  it('resolves the seeded operator default currency and returns scoped figures (AC2)', async () => {
    const operator = await loadOperator(parseEnv().SEED_OPERATOR_EMAIL);
    const window = await loadLatestMonthWindow();
    const expected = await loadExpectedSummary(window, SEED_CURRENCY);

    const summary = await getAnalyticsService().getMonthlySummary(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    expect(operator.defaultCurrency).toBe(SEED_CURRENCY);
    expect(summary.currency).toBe(SEED_CURRENCY);
    expect(summary.income).toBe(expected.income);
    expect(summary.expense).toBe(expected.expense);
    expect(summary.net).toBe(expected.net);
  });
});

describe('AnalyticsRepository category breakdown (Testcontainers Postgres)', () => {
  it('rolls every descendant spend up to its top-level ancestor (AC2 restructured hierarchy)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    const foodRow = result.breakdown.find((row) => row.categoryId === fixture.foodRootId);
    const transportRow = result.breakdown.find((row) => row.categoryId === fixture.transportRootId);

    expect(result.breakdown).toHaveLength(EXPECTED_BREAKDOWN_ROW_COUNT);
    expect(foodRow?.total).toBe(FOOD_ROOT_TOTAL);
    expect(transportRow?.total).toBe(TRANSPORT_ROOT_TOTAL);
    expect(result.breakdown.some((row) => row.categoryName === 'Restaurants')).toBe(false);
    expect(result.breakdown.some((row) => row.categoryName === 'Fast Food')).toBe(false);
  });

  it('orders breakdown rows by amount descending (AC4c)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    expect(result.breakdown.map((row) => row.categoryId)).toEqual([
      fixture.transportRootId,
      fixture.foodRootId,
    ]);
  });

  it('reconciles the breakdown totals exactly with the summary expense (AC4b, FR18)', async () => {
    const fixture = await seedBreakdownFixture();

    const breakdown = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });
    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    const summedTotal = breakdown.breakdown
      .reduce((total, row) => total.plus(new Decimal(row.total)), new Decimal(0))
      .toFixed(MONEY_SCALE);

    expect(breakdown.totalExpense).toBe(BREAKDOWN_TOTAL_EXPENSE);
    expect(summedTotal).toBe(summary.expense);
    expect(breakdown.totalExpense).toBe(summary.expense);
  });

  it('computes share-of-total as a percentage that reflects each root total', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    const foodRow = result.breakdown.find((row) => row.categoryId === fixture.foodRootId);
    const transportRow = result.breakdown.find((row) => row.categoryId === fixture.transportRootId);

    expect(foodRow?.share).toBeCloseTo(FOOD_SHARE);
    expect(transportRow?.share).toBeCloseTo(TRANSPORT_SHARE);
  });

  it('excludes cross-currency and cross-user expenses from the breakdown (AC4d, AC4e)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    expect(result.breakdown).toHaveLength(EXPECTED_BREAKDOWN_ROW_COUNT);
    expect(result.totalExpense).toBe(BREAKDOWN_TOTAL_EXPENSE);
  });
});

describe('AnalyticsService category breakdown (Testcontainers Postgres)', () => {
  it('resolves the seeded operator default currency for the breakdown (AC1)', async () => {
    const window = await loadLatestMonthWindow();

    const breakdown = await getAnalyticsService().getCategoryBreakdown(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });
    const summary = await getAnalyticsService().getMonthlySummary(operatorId, {
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
    });

    const summedTotal = breakdown.breakdown
      .reduce((total, row) => total.plus(new Decimal(row.total)), new Decimal(0))
      .toFixed(MONEY_SCALE);

    expect(breakdown.currency).toBe(SEED_CURRENCY);
    expect(summedTotal).toBe(summary.expense);
    expect(breakdown.totalExpense).toBe(summary.expense);
  });
});

const TREND_WINDOW = { dateFrom: '2030-01-01', dateTo: '2030-12-31' };
const TREND_YEAR = 2030;
const MONTHS_PER_YEAR = 12;
const EXPECTED_TREND_ROW_COUNT = 12;
const EMPTY_TREND_MONTH = '2030-02';

interface TrendSeedTransaction {
  date: string;
  type: string;
  amount: string;
  currency: string;
}

const TREND_USER_TRANSACTIONS: TrendSeedTransaction[] = [
  { date: '2030-01-10', type: 'income', amount: '100.00', currency: SEED_CURRENCY },
  { date: '2030-01-20', type: 'expense', amount: '40.00', currency: SEED_CURRENCY },
  { date: '2030-03-05', type: 'expense', amount: '25.50', currency: SEED_CURRENCY },
  { date: '2030-12-31', type: 'income', amount: '1000.00', currency: SEED_CURRENCY },
  { date: '2029-12-15', type: 'expense', amount: '999.99', currency: SEED_CURRENCY },
  { date: '2030-01-15', type: 'expense', amount: '555.55', currency: FOREIGN_CURRENCY },
];

const TREND_CROSS_USER_TRANSACTION: TrendSeedTransaction = {
  date: '2030-06-10',
  type: 'expense',
  amount: '777.00',
  currency: SEED_CURRENCY,
};

const insertDatedTransaction = async (params: {
  userId: string;
  categoryId: string;
  amount: string;
  currency: string;
  type: string;
  date: string;
}): Promise<void> => {
  await getPool().query(
    `INSERT INTO transactions (id, user_id, category_id, type, amount, currency, date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, '')`,
    [
      generateId(),
      params.userId,
      params.categoryId,
      params.type,
      params.amount,
      params.currency,
      params.date,
    ],
  );
};

const sumByType = (recordList: TrendSeedTransaction[], type: string): string =>
  recordList
    .filter((record) => record.type === type)
    .reduce((total, record) => total.plus(new Decimal(record.amount)), new Decimal(0))
    .toFixed(MONEY_SCALE);

const computeExpectedTrend = (): { month: string; income: string; expense: string }[] =>
  [...Array(MONTHS_PER_YEAR).keys()].map((index) => {
    const month = `${TREND_YEAR}-${padTwoDigits(index + 1)}`;
    const monthRecordList = TREND_USER_TRANSACTIONS.filter(
      (record) => record.currency === SEED_CURRENCY && record.date.startsWith(month),
    );

    return {
      month,
      income: sumByType(monthRecordList, 'income'),
      expense: sumByType(monthRecordList, 'expense'),
    };
  });

const seedTrendFixture = async (): Promise<{ userId: string }> => {
  const userId = await insertUser('Trend User');
  const categoryId = await insertExpenseCategory({ userId, name: 'Trend', parentId: null });
  await Promise.all(
    TREND_USER_TRANSACTIONS.map((record) =>
      insertDatedTransaction({ userId, categoryId, ...record }),
    ),
  );

  const otherUserId = await insertUser('Trend Other User');
  const otherCategoryId = await insertExpenseCategory({
    userId: otherUserId,
    name: 'Trend Other',
    parentId: null,
  });
  await insertDatedTransaction({
    userId: otherUserId,
    categoryId: otherCategoryId,
    ...TREND_CROSS_USER_TRANSACTION,
  });

  return { userId };
};

describe('AnalyticsRepository monthly trend (Testcontainers Postgres)', () => {
  it('returns exactly 12 monthly buckets in ascending chronological order (AC1, AC5c)', async () => {
    const fixture = await seedTrendFixture();

    const result = await getAnalyticsRepository().getMonthlyTrend({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: TREND_WINDOW.dateFrom,
      dateTo: TREND_WINDOW.dateTo,
    });

    const monthList = result.trend.map((row) => row.month);
    const expectedMonthList = computeExpectedTrend().map((row) => row.month);
    expect(result.trend).toHaveLength(EXPECTED_TREND_ROW_COUNT);
    expect(monthList).toEqual(expectedMonthList);
  });

  it('matches each month income and expense to independently summed seed totals (AC5a, FR18)', async () => {
    const fixture = await seedTrendFixture();

    const result = await getAnalyticsRepository().getMonthlyTrend({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: TREND_WINDOW.dateFrom,
      dateTo: TREND_WINDOW.dateTo,
    });

    expect(result.trend).toEqual(computeExpectedTrend());
    expect(result.currency).toBe(SEED_CURRENCY);
    expect(typeof result.trend[0]?.income).toBe('string');
  });

  it('fills a transaction-free in-window month with zeros and still includes it (AC5b zero-month)', async () => {
    const fixture = await seedTrendFixture();

    const result = await getAnalyticsRepository().getMonthlyTrend({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: TREND_WINDOW.dateFrom,
      dateTo: TREND_WINDOW.dateTo,
    });

    const emptyMonthRow = result.trend.find((row) => row.month === EMPTY_TREND_MONTH);
    expect(emptyMonthRow).toEqual({ month: EMPTY_TREND_MONTH, income: '0.00', expense: '0.00' });
  });

  it('excludes a transaction in the month just before the window (AC5f boundary)', async () => {
    const fixture = await seedTrendFixture();

    const result = await getAnalyticsRepository().getMonthlyTrend({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: TREND_WINDOW.dateFrom,
      dateTo: TREND_WINDOW.dateTo,
    });

    expect(result.trend.some((row) => row.month === '2029-12')).toBe(false);
    const januaryRow = result.trend.find((row) => row.month === '2030-01');
    expect(januaryRow?.expense).toBe('40.00');
  });

  it('excludes cross-currency and cross-user transactions from the trend (AC5d, AC5e)', async () => {
    const fixture = await seedTrendFixture();

    const result = await getAnalyticsRepository().getMonthlyTrend({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: TREND_WINDOW.dateFrom,
      dateTo: TREND_WINDOW.dateTo,
    });

    const januaryRow = result.trend.find((row) => row.month === '2030-01');
    const juneRow = result.trend.find((row) => row.month === '2030-06');
    expect(januaryRow?.expense).toBe('40.00');
    expect(juneRow).toEqual({ month: '2030-06', income: '0.00', expense: '0.00' });
  });
});

describe('AnalyticsService monthly trend (Testcontainers Postgres)', () => {
  it('resolves the user default currency and returns 12 scoped monthly buckets (AC1)', async () => {
    const fixture = await seedTrendFixture();

    const trend = await getAnalyticsService().getMonthlyTrend(fixture.userId, TREND_WINDOW);

    expect(trend.currency).toBe(SEED_CURRENCY);
    expect(trend.trend).toHaveLength(EXPECTED_TREND_ROW_COUNT);
    expect(trend.trend).toEqual(computeExpectedTrend());
  });
});

const TOP_CATEGORIES_TRANSPORT_TOTAL = '100.00';
const TOP_CATEGORIES_FOOD_TOTAL = '60.00';
const TOP_CATEGORIES_FOOD_COUNT = 3;
const TOP_CATEGORIES_TRANSPORT_COUNT = 1;
const TOP_CATEGORIES_LIMIT_ONE = 1;
const TOP_CATEGORIES_TOTAL_EXPENSE = '160.00';
const TOP_CATEGORIES_ROW_COUNT = 2;
const TOP_CATEGORIES_EXPECTED_RANK_LIST = Array.from(
  { length: TOP_CATEGORIES_ROW_COUNT },
  (_unused, index) => index + 1,
);
const LAST_INDEX_OFFSET = 1;

const sumTotals = (totalList: string[]): string =>
  totalList
    .reduce((total, value) => total.plus(new Decimal(value)), new Decimal(0))
    .toFixed(MONEY_SCALE);

describe('AnalyticsRepository top categories (Testcontainers Postgres)', () => {
  it('rolls descendant spend up to the top-level ancestor and ranks by amount descending (AC1)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getTopCategories({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
      limit: 5,
    });

    expect(result.categories).toHaveLength(TOP_CATEGORIES_ROW_COUNT);
    expect(result.categories.map((category) => category.categoryId)).toEqual([
      fixture.transportRootId,
      fixture.foodRootId,
    ]);
    expect(result.categories.map((category) => category.rank)).toEqual(
      TOP_CATEGORIES_EXPECTED_RANK_LIST,
    );
    expect(result.categories.some((category) => category.categoryName === 'Restaurants')).toBe(
      false,
    );
    expect(result.categories.some((category) => category.categoryName === 'Fast Food')).toBe(false);
  });

  it('reports the rolled-up total and transaction count per top-level category (AC1, D5)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getTopCategories({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
      limit: 5,
    });

    const foodRow = result.categories.find(
      (category) => category.categoryId === fixture.foodRootId,
    );
    const transportRow = result.categories.find(
      (category) => category.categoryId === fixture.transportRootId,
    );

    expect(foodRow?.total).toBe(TOP_CATEGORIES_FOOD_TOTAL);
    expect(foodRow?.transactionCount).toBe(TOP_CATEGORIES_FOOD_COUNT);
    expect(transportRow?.total).toBe(TOP_CATEGORIES_TRANSPORT_TOTAL);
    expect(transportRow?.transactionCount).toBe(TOP_CATEGORIES_TRANSPORT_COUNT);
    expect(typeof foodRow?.total).toBe('string');
  });

  it('honours the limit while keeping the grand total across all categories (AC2)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getTopCategories({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
      limit: TOP_CATEGORIES_LIMIT_ONE,
    });

    expect(result.categories).toHaveLength(TOP_CATEGORIES_LIMIT_ONE);
    expect(result.categories[0]?.categoryId).toBe(fixture.transportRootId);
    expect(result.categories[0]?.rank).toBe(1);
    expect(result.totalExpense).toBe(TOP_CATEGORIES_TOTAL_EXPENSE);
  });

  it('reconciles the grand total exactly with the summary expense and excludes cross-currency, cross-user and income rows (AC2, AC6f, FR18)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsRepository().getTopCategories({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
      limit: 5,
    });
    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    const summedTotal = sumTotals(result.categories.map((category) => category.total));

    expect(result.totalExpense).toBe(TOP_CATEGORIES_TOTAL_EXPENSE);
    expect(result.totalExpense).toBe(summary.expense);
    expect(summedTotal).toBe(summary.expense);
    expect(new Decimal(summedTotal).lessThanOrEqualTo(new Decimal(result.totalExpense))).toBe(true);
  });
});

describe('AnalyticsService top categories (Testcontainers Postgres)', () => {
  it('applies the default limit and resolves the operator default currency (AC2)', async () => {
    const fixture = await seedBreakdownFixture();

    const result = await getAnalyticsService().getTopCategories(fixture.userId, {
      dateFrom: BREAKDOWN_WINDOW.dateFrom,
      dateTo: BREAKDOWN_WINDOW.dateTo,
    });

    expect(result.currency).toBe(SEED_CURRENCY);
    expect(result.categories).toHaveLength(TOP_CATEGORIES_ROW_COUNT);
    expect(result.totalExpense).toBe(TOP_CATEGORIES_TOTAL_EXPENSE);
  });
});

const DAILY_WINDOW = { dateFrom: '2031-01-30', dateTo: '2031-02-03' };
const DAILY_OUT_OF_WINDOW_DATE = '2031-01-15';
const DAILY_EXPECTED_DAY_COUNT = 5;
const DAILY_TOTAL_EXPENSE = '65.00';

interface DailySeedTransaction {
  date: string;
  type: string;
  amount: string;
  currency: string;
}

const DAILY_USER_TRANSACTIONS: DailySeedTransaction[] = [
  { date: '2031-01-30', type: 'expense', amount: '10.00', currency: SEED_CURRENCY },
  { date: '2031-01-30', type: 'expense', amount: '5.00', currency: SEED_CURRENCY },
  { date: '2031-02-01', type: 'expense', amount: '20.00', currency: SEED_CURRENCY },
  { date: '2031-02-03', type: 'expense', amount: '30.00', currency: SEED_CURRENCY },
  { date: DAILY_OUT_OF_WINDOW_DATE, type: 'expense', amount: '999.99', currency: SEED_CURRENCY },
  { date: '2031-02-01', type: 'income', amount: '500.00', currency: SEED_CURRENCY },
  { date: '2031-02-01', type: 'expense', amount: '777.00', currency: FOREIGN_CURRENCY },
];

const DAILY_CROSS_USER_TRANSACTION: DailySeedTransaction = {
  date: '2031-02-01',
  type: 'expense',
  amount: '888.00',
  currency: SEED_CURRENCY,
};

interface DailyExpectedDay {
  date: string;
  total: string;
  transactionCount: number;
}

const DAILY_EXPECTED_DAYS: DailyExpectedDay[] = [
  { date: '2031-01-30', total: '15.00', transactionCount: 2 },
  { date: '2031-01-31', total: '0.00', transactionCount: 0 },
  { date: '2031-02-01', total: '20.00', transactionCount: 1 },
  { date: '2031-02-02', total: '0.00', transactionCount: 0 },
  { date: '2031-02-03', total: '30.00', transactionCount: 1 },
];

const seedDailySpendingFixture = async (): Promise<{ userId: string }> => {
  const userId = await insertUser('Daily User');
  const categoryId = await insertExpenseCategory({ userId, name: 'Daily', parentId: null });
  await Promise.all(
    DAILY_USER_TRANSACTIONS.map((record) =>
      insertDatedTransaction({ userId, categoryId, ...record }),
    ),
  );

  const otherUserId = await insertUser('Daily Other User');
  const otherCategoryId = await insertExpenseCategory({
    userId: otherUserId,
    name: 'Daily Other',
    parentId: null,
  });
  await insertDatedTransaction({
    userId: otherUserId,
    categoryId: otherCategoryId,
    ...DAILY_CROSS_USER_TRANSACTION,
  });

  return { userId };
};

describe('AnalyticsRepository daily spending (Testcontainers Postgres)', () => {
  it('returns per-day expense totals for the exact range, zero-filling empty days (AC3, §5 defect fixed)', async () => {
    const fixture = await seedDailySpendingFixture();

    const result = await getAnalyticsRepository().getDailySpending({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: DAILY_WINDOW.dateFrom,
      dateTo: DAILY_WINDOW.dateTo,
    });

    expect(result.days).toHaveLength(DAILY_EXPECTED_DAY_COUNT);
    expect(result.days).toEqual(DAILY_EXPECTED_DAYS);
    expect(typeof result.days[0]?.total).toBe('string');
  });

  it('honours a multi-month window and excludes a same-month transaction outside the range (§5 regression guard)', async () => {
    const fixture = await seedDailySpendingFixture();

    const result = await getAnalyticsRepository().getDailySpending({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: DAILY_WINDOW.dateFrom,
      dateTo: DAILY_WINDOW.dateTo,
    });

    expect(result.days[0]?.date).toBe(DAILY_WINDOW.dateFrom);
    expect(result.days[result.days.length - LAST_INDEX_OFFSET]?.date).toBe(DAILY_WINDOW.dateTo);
    expect(result.days.some((day) => day.date === DAILY_OUT_OF_WINDOW_DATE)).toBe(false);
  });

  it('reconciles the grand total exactly with the summary expense over the same range (AC3, FR18)', async () => {
    const fixture = await seedDailySpendingFixture();

    const result = await getAnalyticsRepository().getDailySpending({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: DAILY_WINDOW.dateFrom,
      dateTo: DAILY_WINDOW.dateTo,
    });
    const summary = await getAnalyticsRepository().getMonthlySummary({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: DAILY_WINDOW.dateFrom,
      dateTo: DAILY_WINDOW.dateTo,
    });

    const summedTotal = sumTotals(result.days.map((day) => day.total));

    expect(result.totalExpense).toBe(DAILY_TOTAL_EXPENSE);
    expect(result.totalExpense).toBe(summary.expense);
    expect(summedTotal).toBe(summary.expense);
  });
});

describe('AnalyticsService daily spending (Testcontainers Postgres)', () => {
  it('resolves the user default currency and returns the range days zero-filled (AC3)', async () => {
    const fixture = await seedDailySpendingFixture();

    const result = await getAnalyticsService().getDailySpending(fixture.userId, DAILY_WINDOW);

    expect(result.currency).toBe(SEED_CURRENCY);
    expect(result.days).toHaveLength(DAILY_EXPECTED_DAY_COUNT);
    expect(result.days).toEqual(DAILY_EXPECTED_DAYS);
    expect(result.totalExpense).toBe(DAILY_TOTAL_EXPENSE);
  });
});
