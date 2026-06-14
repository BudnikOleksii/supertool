import type { StartedTestContainer } from 'testcontainers';

import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { SeedSourceRecord } from '../../src/database/seeds/seed.types.js';

import { parseEnv } from '../../src/app/env.schema.js';
import { deriveCategoryHierarchy } from '../../src/database/seeds/derive-category-hierarchy.js';
import { loadSeedData } from '../../src/database/seeds/load-seed-data.js';
import { assertDecimalSafeSums } from '../helpers/decimal-safe-sums.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const POSTGRES_PORT = 5432;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;
const EXPECTED_RECORD_COUNT = 1880;
const DUAL_LEVEL_NAME_LIST = ["Здоров'я", 'Навчання', 'Одяг'];

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');
const seedDataDir = resolve(process.cwd(), 'src/database/data');

let container: StartedTestContainer | undefined = undefined;
let pool: Pool | undefined = undefined;
let authDatabasePool: Pool | undefined = undefined;
const moduleNotLoaded = (): Promise<void> => Promise.reject(new Error('seed module not loaded'));
let prepareDatabase: (options: { databaseUrl: string; migrationsFolder: string }) => Promise<void> =
  moduleNotLoaded;
let runSeed: (options: { databaseUrl: string }) => Promise<void> = moduleNotLoaded;
let databaseUrl = '';
let recordList: SeedSourceRecord[] = [];
let operatorId = '';
let operatorRole = '';

const getPool = (): Pool => {
  if (!pool) {
    throw new Error('Postgres pool is not initialised');
  }
  return pool;
};

const loadOperator = async (email: string): Promise<{ id: string; role: string }> => {
  const result = await getPool().query<{ id: string; role: string }>(
    `SELECT id, role FROM users WHERE email = $1`,
    [email],
  );
  const [operator] = result.rows;
  if (!operator) {
    throw new Error('Operator account was not created by the seed');
  }
  return operator;
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

const countScopedRows = async (
  table: 'transactions' | 'transaction_categories',
  whereClause = '1 = 1',
): Promise<number> => {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE user_id = $1 AND ${whereClause}`,
    [operatorId],
  );
  return result.rows[0]?.count ?? 0;
};

beforeAll(async () => {
  recordList = loadSeedData(seedDataDir);
  container = await startPostgresContainer();
  databaseUrl = `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;
  process.env.DATABASE_URL = databaseUrl;

  ({ prepareDatabase } = await import('../../src/database/prepare-database.js'));
  ({ runSeed } = await import('../../src/database/run-seed.js'));
  ({ authDatabasePool } = await import('../../src/auth/auth.js'));

  pool = new Pool({ connectionString: databaseUrl });

  await prepareDatabase({ databaseUrl, migrationsFolder });

  ({ id: operatorId, role: operatorRole } = await loadOperator(parseEnv().SEED_OPERATOR_EMAIL));
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await pool?.end();
  await authDatabasePool?.end();
  await container?.stop();
});

describe('seed (Testcontainers Postgres)', () => {
  it('seeds an empty database to the full record set through the boot sequence (AC3, AC7)', async () => {
    expect(await countScopedRows('transactions')).toBe(EXPECTED_RECORD_COUNT);
  });

  it('creates an admin operator and scopes every imported row to it (AC6, AC9e)', async () => {
    const expectedHierarchy = deriveCategoryHierarchy(recordList);
    const expectedCategoryCount =
      expectedHierarchy.topLevelList.length + expectedHierarchy.childList.length;

    expect(operatorRole).toBe('admin');
    expect(await countScopedRows('transactions')).toBe(EXPECTED_RECORD_COUNT);
    expect(await countScopedRows('transaction_categories')).toBe(expectedCategoryCount);
  });

  it('derives the two-level category tree exactly (AC2, AC9d)', async () => {
    const expectedHierarchy = deriveCategoryHierarchy(recordList);

    expect(await countScopedRows('transaction_categories', 'parent_id IS NULL')).toBe(
      expectedHierarchy.topLevelList.length,
    );
    expect(await countScopedRows('transaction_categories', 'parent_id IS NOT NULL')).toBe(
      expectedHierarchy.childList.length,
    );

    const orphanResult = await getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM transaction_categories child
       WHERE child.user_id = $1
         AND child.parent_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM transaction_categories parent
           WHERE parent.id = child.parent_id AND parent.user_id = child.user_id
         )`,
      [operatorId],
    );
    expect(orphanResult.rows[0]?.count ?? 0).toBe(0);

    const dualLevelResult = await getPool().query<{ parentIsNull: boolean; count: number }>(
      `SELECT parent_id IS NULL AS "parentIsNull", COUNT(*)::int AS count
       FROM transaction_categories
       WHERE user_id = $1 AND name = ANY($2)
       GROUP BY parent_id IS NULL`,
      [operatorId, DUAL_LEVEL_NAME_LIST],
    );
    const dualLevelTopLevelCount = dualLevelResult.rows.find((row) => row.parentIsNull)?.count ?? 0;
    const dualLevelChildCount = dualLevelResult.rows.find((row) => !row.parentIsNull)?.count ?? 0;

    expect(dualLevelTopLevelCount).toBe(DUAL_LEVEL_NAME_LIST.length);
    expect(dualLevelChildCount).toBe(DUAL_LEVEL_NAME_LIST.length);
  });

  it('preserves money as decimal-safe per-currency sums (AC8, AC9b)', async () => {
    await assertDecimalSafeSums({ pool: getPool(), userId: operatorId, recordList });
  });

  it('re-running the seed introduces zero duplicate rows (AC5, AC9a)', async () => {
    const transactionsBefore = await countScopedRows('transactions');
    const categoriesBefore = await countScopedRows('transaction_categories');

    await runSeed({ databaseUrl });

    expect(await countScopedRows('transactions')).toBe(transactionsBefore);
    expect(await countScopedRows('transaction_categories')).toBe(categoriesBefore);
    expect(await countScopedRows('transactions')).toBe(EXPECTED_RECORD_COUNT);
  });
});
