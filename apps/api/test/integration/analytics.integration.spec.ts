import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { StartedTestContainer } from 'testcontainers';

import Decimal from 'decimal.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseEnv } from '../../src/app/env.schema.js';
import { generateId } from '../../src/database/generate-id.js';
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

const loadSeedModules = async (): Promise<void> => {
  ({ prepareDatabase } = await import('../../src/database/prepare-database.js'));
  ({ runSeed } = await import('../../src/database/run-seed.js'));
  ({ authDatabasePool } = await import('../../src/auth/auth.js'));
};

const connectDatabase = (databaseUrl: string): void => {
  pool = new Pool({ connectionString: databaseUrl });
  database = drizzle(pool);
  analyticsRepository = new AnalyticsRepository(database);
  analyticsService = new AnalyticsService(analyticsRepository, new UsersRepository(database));
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
