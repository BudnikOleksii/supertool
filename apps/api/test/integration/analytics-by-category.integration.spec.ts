import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { StartedTestContainer } from 'testcontainers';

import Decimal from 'decimal.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ByCategoryNodeDto } from '../../src/modules/analytics/dtos/by-category-node.dto.js';

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
const SEED_CURRENCY = 'UAH';
const FOREIGN_CURRENCY = 'USD';
const WINDOW = { dateFrom: '2099-03-01', dateTo: '2099-03-31' };
const IN_WINDOW_DATE = '2099-03-15';
const OUT_OF_WINDOW_DATE = '2099-04-15';
const EMPTY_WINDOW = { dateFrom: '1900-01-01', dateTo: '1900-01-31' };

const EXPECTED_FOOD_TOTAL = '60.00';
const EXPECTED_FOOD_COUNT = 3;
const EXPECTED_RESTAURANTS_TOTAL = '50.00';
const EXPECTED_RESTAURANTS_COUNT = 2;
const EXPECTED_FAST_FOOD_TOTAL = '30.00';
const EXPECTED_FAST_FOOD_COUNT = 1;
const EXPECTED_TRANSPORT_TOTAL = '100.00';
const EXPECTED_TRANSPORT_COUNT = 1;
const EXPECTED_SALARY_TOTAL = '500.00';
const EXPECTED_SALARY_COUNT = 1;
const EXPECTED_CATEGORY_COUNT = 5;

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let authDatabasePool: Pool | undefined = undefined;
let database: NodePgDatabase | undefined = undefined;
let analyticsRepository: AnalyticsRepository | undefined = undefined;
let analyticsService: AnalyticsService | undefined = undefined;

const moduleNotLoaded = (): Promise<void> => Promise.reject(new Error('module not loaded'));
let prepareDatabase: (options: { databaseUrl: string; migrationsFolder: string }) => Promise<void> =
  moduleNotLoaded;

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

const insertUser = async (name: string, defaultCurrency: string | null): Promise<string> => {
  const userId = generateId();
  await getPool().query(
    `INSERT INTO users (id, name, email, default_currency) VALUES ($1, $2, $3, $4)`,
    [
      userId,
      name,
      `${name.replace(/\s+/gu, '-').toLowerCase()}-${userId}@example.com`,
      defaultCurrency,
    ],
  );
  return userId;
};

const insertCategory = async (params: {
  userId: string;
  name: string;
  type: string;
  parentId: string | null;
}): Promise<string> => {
  const id = generateId();
  await getPool().query(
    `INSERT INTO transaction_categories (id, user_id, name, type, parent_id) VALUES ($1, $2, $3, $4, $5)`,
    [id, params.userId, params.name, params.type, params.parentId],
  );
  return id;
};

const insertTransaction = async (params: {
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

interface FixtureIds {
  foodId: string;
  restaurantsId: string;
  fastFoodId: string;
  transportId: string;
  salaryId: string;
}

interface Fixture extends FixtureIds {
  userId: string;
}

interface FixtureTransaction {
  categoryId: string;
  amount: string;
  currency: string;
  type: string;
  date: string;
}

const insertFixtureCategories = async (userId: string): Promise<FixtureIds> => {
  const foodId = await insertCategory({ userId, name: 'Food', type: 'expense', parentId: null });
  const restaurantsId = await insertCategory({
    userId,
    name: 'Restaurants',
    type: 'expense',
    parentId: foodId,
  });
  const fastFoodId = await insertCategory({
    userId,
    name: 'Fast Food',
    type: 'expense',
    parentId: restaurantsId,
  });
  const transportId = await insertCategory({
    userId,
    name: 'Transport',
    type: 'expense',
    parentId: null,
  });
  const salaryId = await insertCategory({ userId, name: 'Salary', type: 'income', parentId: null });

  return { foodId, restaurantsId, fastFoodId, transportId, salaryId };
};

const buildFixtureTransactionList = (ids: FixtureIds): FixtureTransaction[] => [
  {
    categoryId: ids.foodId,
    amount: '10.00',
    currency: SEED_CURRENCY,
    type: 'expense',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.restaurantsId,
    amount: '20.00',
    currency: SEED_CURRENCY,
    type: 'expense',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.fastFoodId,
    amount: '30.00',
    currency: SEED_CURRENCY,
    type: 'expense',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.transportId,
    amount: '100.00',
    currency: SEED_CURRENCY,
    type: 'expense',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.salaryId,
    amount: '500.00',
    currency: SEED_CURRENCY,
    type: 'income',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.foodId,
    amount: '999.99',
    currency: SEED_CURRENCY,
    type: 'income',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.foodId,
    amount: '7.77',
    currency: FOREIGN_CURRENCY,
    type: 'expense',
    date: IN_WINDOW_DATE,
  },
  {
    categoryId: ids.foodId,
    amount: '55.55',
    currency: SEED_CURRENCY,
    type: 'expense',
    date: OUT_OF_WINDOW_DATE,
  },
];

const seedFixture = async (defaultCurrency: string | null = SEED_CURRENCY): Promise<Fixture> => {
  const userId = await insertUser('By Category User', defaultCurrency);
  const ids = await insertFixtureCategories(userId);

  await Promise.all(
    buildFixtureTransactionList(ids).map((entry) => insertTransaction({ userId, ...entry })),
  );

  return { userId, ...ids };
};

const findNode = (categories: ByCategoryNodeDto[], categoryId: string): ByCategoryNodeDto => {
  const node = categories.find((entry) => entry.categoryId === categoryId);
  if (!node) {
    throw new Error(`Category node ${categoryId} not found in result`);
  }
  return node;
};

interface NodeExpectation {
  total: string;
  transactionCount: number;
  parentId?: string | null;
}

const expectNode = (
  categories: ByCategoryNodeDto[],
  categoryId: string,
  expected: NodeExpectation,
): void => {
  const node = findNode(categories, categoryId);
  expect(node.total).toBe(expected.total);
  expect(typeof node.total).toBe('string');
  expect(node.transactionCount).toBe(expected.transactionCount);
  if (expected.parentId !== undefined) {
    expect(node.parentId).toBe(expected.parentId);
  }
};

const loadSeedModules = async (): Promise<void> => {
  ({ prepareDatabase } = await import('../../src/database/prepare-database.js'));
  ({ authDatabasePool } = await import('../../src/auth/auth.js'));
};

beforeAll(async () => {
  container = await startPostgresContainer();
  const databaseUrl = buildDatabaseUrl(container);
  process.env.DATABASE_URL = databaseUrl;

  await loadSeedModules();

  pool = new Pool({ connectionString: databaseUrl });
  database = drizzle(pool);
  analyticsRepository = new AnalyticsRepository(database);
  analyticsService = new AnalyticsService(
    analyticsRepository,
    new UsersRepository(database),
    new AnalyticsCacheService(),
  );

  await prepareDatabase({ databaseUrl, migrationsFolder: MIGRATIONS_FOLDER });
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await pool?.end();
  await authDatabasePool?.end();
  await container?.stop();
});

describe('AnalyticsRepository by-category totals (Testcontainers Postgres)', () => {
  it('returns every category node with subtree-rolled-up string totals and counts (AC1, FR18)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    expect(result.categories).toHaveLength(EXPECTED_CATEGORY_COUNT);
    expect(result.currency).toBe(SEED_CURRENCY);
    expectNode(result.categories, fixture.foodId, {
      total: EXPECTED_FOOD_TOTAL,
      transactionCount: EXPECTED_FOOD_COUNT,
      parentId: null,
    });
    expectNode(result.categories, fixture.restaurantsId, {
      total: EXPECTED_RESTAURANTS_TOTAL,
      transactionCount: EXPECTED_RESTAURANTS_COUNT,
      parentId: fixture.foodId,
    });
    expectNode(result.categories, fixture.fastFoodId, {
      total: EXPECTED_FAST_FOOD_TOTAL,
      transactionCount: EXPECTED_FAST_FOOD_COUNT,
    });
    expectNode(result.categories, fixture.transportId, {
      total: EXPECTED_TRANSPORT_TOTAL,
      transactionCount: EXPECTED_TRANSPORT_COUNT,
    });
  });

  it('rolls a deeply nested descendant spend up to its ancestor node (AC1 restructured hierarchy)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    const food = findNode(result.categories, fixture.foodId);
    const restaurants = findNode(result.categories, fixture.restaurantsId);
    const fastFood = findNode(result.categories, fixture.fastFoodId);

    expect(food.total).toBe(
      new Decimal('10.00').plus(new Decimal(restaurants.total)).toFixed(MONEY_SCALE),
    );
    expect(restaurants.total).toBe(
      new Decimal('20.00').plus(new Decimal(fastFood.total)).toFixed(MONEY_SCALE),
    );
    expect(new Decimal(food.total).greaterThan(new Decimal(restaurants.total))).toBe(true);
    expect(new Decimal(restaurants.total).greaterThan(new Decimal(fastFood.total))).toBe(true);
  });

  it('sums income categories with their income totals scoped by node type (AC1, D-2)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    const salary = findNode(result.categories, fixture.salaryId);
    const food = findNode(result.categories, fixture.foodId);

    expect(salary.total).toBe(EXPECTED_SALARY_TOTAL);
    expect(salary.transactionCount).toBe(EXPECTED_SALARY_COUNT);
    expect(salary.type).toBe('income');
    expect(food.total).toBe(EXPECTED_FOOD_TOTAL);
  });

  it('reconciles expense-node rolled-up totals exactly with the breakdown endpoint (AC1, FR18)', async () => {
    const fixture = await seedFixture();

    const byCategory = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });
    const breakdown = await getAnalyticsRepository().getCategoryBreakdown({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    for (const breakdownRow of breakdown.breakdown) {
      const node = findNode(byCategory.categories, breakdownRow.categoryId);
      expect(node.total).toBe(breakdownRow.total);
    }
  });

  it('excludes cross-currency and out-of-window transactions from node totals (AC1)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    const food = findNode(result.categories, fixture.foodId);
    expect(food.total).toBe(EXPECTED_FOOD_TOTAL);
  });

  it("excludes another user's categories and transactions (FR21 user scoping)", async () => {
    const fixture = await seedFixture();
    const otherFixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: WINDOW.dateFrom,
      dateTo: WINDOW.dateTo,
    });

    const idList = result.categories.map((entry) => entry.categoryId);
    expect(idList).toContain(fixture.foodId);
    expect(idList).not.toContain(otherFixture.foodId);
    expect(result.categories).toHaveLength(EXPECTED_CATEGORY_COUNT);
  });

  it('returns zero totals and counts for categories with no transactions in the window (AC4)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsRepository().getByCategoryTotals({
      userId: fixture.userId,
      currency: SEED_CURRENCY,
      dateFrom: EMPTY_WINDOW.dateFrom,
      dateTo: EMPTY_WINDOW.dateTo,
    });

    expect(result.categories).toHaveLength(EXPECTED_CATEGORY_COUNT);
    for (const node of result.categories) {
      expect(node.total).toBe('0.00');
      expect(node.transactionCount).toBe(0);
    }
  });
});

describe('AnalyticsService by-category (Testcontainers Postgres)', () => {
  it('resolves the user default currency and returns scoped node totals (AC1)', async () => {
    const fixture = await seedFixture();

    const result = await getAnalyticsService().getByCategory(fixture.userId, WINDOW);

    expect(result.currency).toBe(SEED_CURRENCY);
    const food = findNode(result.categories, fixture.foodId);
    expect(food.total).toBe(EXPECTED_FOOD_TOTAL);
  });

  it('returns an empty result when the user has no default currency (NO_CURRENCY)', async () => {
    const fixture = await seedFixture(null);

    const result = await getAnalyticsService().getByCategory(fixture.userId, WINDOW);

    expect(result).toEqual({ categories: [], currency: '' });
  });
});
