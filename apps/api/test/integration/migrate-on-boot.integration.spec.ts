import type { StartedTestContainer } from 'testcontainers';

import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '../../src/database/run-migrations.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const POSTGRES_PORT = 5432;
const CONTAINER_READY_OCCURRENCES = 2;
const BOOT_TIMEOUT_MS = 180_000;

const EXPECTED_TABLE_LIST = ['users', 'sessions', 'accounts', 'verifications'];

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

let container: StartedTestContainer | undefined = undefined;
let databaseUrl = '';

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

const getPublicTableNameList = async (): Promise<string[]> => {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ tableName: string }>(
      `SELECT table_name AS "tableName" FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    return result.rows.map((row) => row.tableName);
  } finally {
    await pool.end();
  }
};

beforeAll(async () => {
  container = await startPostgresContainer();
  databaseUrl = `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await container?.stop();
});

describe('migrate-on-boot (Testcontainers Postgres)', () => {
  it('applies all migrations against an empty database and creates the expected schema', async () => {
    await runMigrations({ databaseUrl, migrationsFolder });

    const tableNameList = await getPublicTableNameList();

    for (const expectedTableName of EXPECTED_TABLE_LIST) {
      expect(tableNameList).toContain(expectedTableName);
    }
  });

  it('is idempotent when run a second time against an already-migrated database', async () => {
    await expect(runMigrations({ databaseUrl, migrationsFolder })).resolves.toBeUndefined();

    const tableNameList = await getPublicTableNameList();

    for (const expectedTableName of EXPECTED_TABLE_LIST) {
      expect(tableNameList).toContain(expectedTableName);
    }
  });
});
