import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { PinoLogger } from 'nestjs-pino';
import type { StartedTestContainer } from 'testcontainers';

import { and, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_SORT_BY, DEFAULT_SORT_ORDER } from '@supertool/shared/constants/transaction-sort';

import type { SeedSourceRecord } from '../../src/database/seeds/seed.types.js';

import { parseEnv } from '../../src/app/env.schema.js';
import { generateId } from '../../src/database/generate-id.js';
import { transactionCategories } from '../../src/database/schemas/transaction-categories.js';
import { users } from '../../src/database/schemas/users.js';
import { AnalyticsCacheService } from '../../src/modules/analytics/analytics-cache.service.js';
import { TransactionsImportService } from '../../src/modules/transactions/transactions-import.service.js';
import { TransactionsRepository } from '../../src/modules/transactions/transactions.repository.js';
import { TransactionsService } from '../../src/modules/transactions/transactions.service.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  MIGRATIONS_FOLDER,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const DEFAULT_SORT = { sortBy: DEFAULT_SORT_BY, sortOrder: DEFAULT_SORT_ORDER };
const ROUND_TRIP_ROW_COUNT = 3;
const FOOD_ROW_COUNT = 2;
const BOM_PATTERN = /^﻿/u;

const ROUND_TRIP_RECORD_LIST: SeedSourceRecord[] = [
  {
    Date: '2025-03-03',
    Category: 'RoundTripFood',
    Subcategory: 'RoundTripGroceries',
    Type: 'Expense',
    Amount: '30.00',
    Currency: 'UAH',
  },
  {
    Date: '2025-03-02',
    Category: 'RoundTripFood',
    Subcategory: 'RoundTripGroceries',
    Type: 'Expense',
    Amount: '20.00',
    Currency: 'UAH',
  },
  {
    Date: '2025-03-01',
    Category: 'RoundTripSalary',
    Type: 'Income',
    Amount: '10.00',
    Currency: 'UAH',
  },
];

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let authDatabasePool: Pool | undefined = undefined;
let database: NodePgDatabase | undefined = undefined;
let repository: TransactionsRepository | undefined = undefined;
let service: TransactionsService | undefined = undefined;
let importService: TransactionsImportService | undefined = undefined;
let operatorId = '';
let roundTripUserId = '';

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

const getDatabase = (): NodePgDatabase => {
  if (!database) {
    throw new Error('Database is not initialised');
  }
  return database;
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

const getImportService = (): TransactionsImportService => {
  if (!importService) {
    throw new Error('Import service is not initialised');
  }
  return importService;
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

const seedRoundTripUser = async (): Promise<string> => {
  const userId = generateId();

  await getDatabase()
    .insert(users)
    .values({ id: userId, name: 'Round Trip User', email: `round-trip-${userId}@example.com` });
  await getRepository().runImport({ userId, recordList: ROUND_TRIP_RECORD_LIST });

  return userId;
};

const loadTopLevelCategoryId = async (userId: string, name: string): Promise<string> => {
  const rows = await getDatabase()
    .select({ id: transactionCategories.id })
    .from(transactionCategories)
    .where(
      and(
        eq(transactionCategories.userId, userId),
        eq(transactionCategories.name, name),
        isNull(transactionCategories.parentId),
      ),
    );
  const [row] = rows;
  if (!row) {
    throw new Error(`Top-level category ${name} not found`);
  }
  return row.id;
};

const buildMulterFile = (originalname: string, content: string): Express.Multer.File =>
  ({ originalname, buffer: Buffer.from(content, 'utf8') }) as unknown as Express.Multer.File;

const parseCsvDataRowList = (content: string): string[] =>
  content
    .replace(BOM_PATTERN, '')
    .split('\r\n')
    .filter((line) => line.length > 0)
    .slice(1);

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
  const analyticsCache = new AnalyticsCacheService();
  service = new TransactionsService(repository, analyticsCache);
  importService = new TransactionsImportService(repository, analyticsCache);
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
  roundTripUserId = await seedRoundTripUser();
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await pool?.end();
  await authDatabasePool?.end();
  await container?.stop();
});

describe('Transaction export (Testcontainers Postgres)', () => {
  it('scopes export rows to the requesting user (FR21)', async () => {
    const scoped = await getService().exportTransactions({
      userId: roundTripUserId,
      format: 'csv',
      filters: { format: 'csv' },
    });
    const operator = await getService().exportTransactions({
      userId: operatorId,
      format: 'csv',
      filters: { format: 'csv' },
    });

    expect(scoped.content).toContain('RoundTripFood');
    expect(operator.content).not.toContain('RoundTripFood');
  });

  it('returns all matching rows without pagination and is not truncated at seed scale', async () => {
    const result = await getRepository().findAllForExport(roundTripUserId, DEFAULT_SORT);

    expect(result.rowList).toHaveLength(ROUND_TRIP_ROW_COUNT);
    expect(result.isTruncated).toBe(false);
  });

  it('emits string amounts and bare calendar dates (D1, RP-D5)', async () => {
    const result = await getRepository().findAllForExport(roundTripUserId, DEFAULT_SORT);
    const [first] = result.rowList;

    expect(first?.amount).toBe('30.00');
    expect(first?.date).toBe('2025-03-03');
  });

  it('honors the sort order', async () => {
    const descending = await getRepository().findAllForExport(roundTripUserId, {
      sortBy: 'date',
      sortOrder: 'desc',
    });
    const ascending = await getRepository().findAllForExport(roundTripUserId, {
      sortBy: 'date',
      sortOrder: 'asc',
    });

    expect(descending.rowList.map((row) => row.date)).toEqual([
      '2025-03-03',
      '2025-03-02',
      '2025-03-01',
    ]);
    expect(ascending.rowList.map((row) => row.date)).toEqual([
      '2025-03-01',
      '2025-03-02',
      '2025-03-03',
    ]);
  });

  it('honors the category subtree filter', async () => {
    const foodId = await loadTopLevelCategoryId(roundTripUserId, 'RoundTripFood');

    const result = await getRepository().findAllForExport(roundTripUserId, {
      ...DEFAULT_SORT,
      categoryId: foodId,
    });

    expect(result.rowList).toHaveLength(FOOD_ROW_COUNT);
    expect(result.rowList.every((row) => row.categoryParentName === 'RoundTripFood')).toBe(true);
  });

  it('sets the CSV content type and range filename', async () => {
    const result = await getService().exportTransactions({
      userId: roundTripUserId,
      format: 'csv',
      filters: { format: 'csv', dateFrom: '2025-03-01', dateTo: '2025-03-31' },
    });

    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.filename).toBe('transactions-2025-03-01_2025-03-31.csv');
    expect(result.content.startsWith('﻿')).toBe(true);
  });

  it('sets the JSON content type and current-date filename', async () => {
    const result = await getService().exportTransactions({
      userId: roundTripUserId,
      format: 'json',
      filters: { format: 'json' },
    });

    expect(result.contentType).toBe('application/json; charset=utf-8');
    expect(result.filename.startsWith('transactions-')).toBe(true);
    expect(result.filename.endsWith('.json')).toBe(true);

    const parsed: unknown = JSON.parse(result.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(result.content).toContain('"Amount":"30.00"');
  });

  it('produces a CSV that round-trips back through import preview as all duplicates (RP-F2)', async () => {
    const exported = await getService().exportTransactions({
      userId: roundTripUserId,
      format: 'csv',
      filters: { format: 'csv' },
    });

    expect(parseCsvDataRowList(exported.content)).toHaveLength(ROUND_TRIP_ROW_COUNT);

    const preview = await getImportService().previewImport(
      roundTripUserId,
      buildMulterFile('export.csv', exported.content),
    );

    expect(preview.totalRows).toBe(ROUND_TRIP_ROW_COUNT);
    expect(preview.duplicateRows).toBe(ROUND_TRIP_ROW_COUNT);
    expect(preview.newRows).toBe(0);
  });

  it('produces JSON that round-trips back through import preview as all duplicates (RP-F2)', async () => {
    const exported = await getService().exportTransactions({
      userId: roundTripUserId,
      format: 'json',
      filters: { format: 'json' },
    });

    const preview = await getImportService().previewImport(
      roundTripUserId,
      buildMulterFile('export.json', exported.content),
    );

    expect(preview.totalRows).toBe(ROUND_TRIP_ROW_COUNT);
    expect(preview.duplicateRows).toBe(ROUND_TRIP_ROW_COUNT);
    expect(preview.newRows).toBe(0);
  });
});
