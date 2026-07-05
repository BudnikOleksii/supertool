import type { StartedTestContainer } from 'testcontainers';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runMigrations } from '../../src/database/run-migrations.js';
import { stopIntegrationApp } from '../helpers/integration-app.js';
import {
  BOOT_TIMEOUT_MS,
  buildDatabaseUrl,
  MIGRATIONS_FOLDER,
  startPostgresContainer,
} from '../helpers/postgres-container.js';

process.env.TESTCONTAINERS_RYUK_DISABLED = 'true';

const EXPECTED_TABLE_LIST = ['users', 'sessions', 'accounts', 'verifications'];

let container: StartedTestContainer | undefined = undefined;
let databaseUrl = '';

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
  databaseUrl = buildDatabaseUrl(container);
}, BOOT_TIMEOUT_MS);

afterAll(async () => {
  await stopIntegrationApp({ container });
});

describe('migrate-on-boot (Testcontainers Postgres)', () => {
  it('applies all migrations against an empty database and creates the expected schema', async () => {
    await runMigrations({ databaseUrl, migrationsFolder: MIGRATIONS_FOLDER });

    const tableNameList = await getPublicTableNameList();

    for (const expectedTableName of EXPECTED_TABLE_LIST) {
      expect(tableNameList).toContain(expectedTableName);
    }
  });

  it('is idempotent when run a second time against an already-migrated database', async () => {
    await expect(
      runMigrations({ databaseUrl, migrationsFolder: MIGRATIONS_FOLDER }),
    ).resolves.toBeUndefined();

    const tableNameList = await getPublicTableNameList();

    for (const expectedTableName of EXPECTED_TABLE_LIST) {
      expect(tableNameList).toContain(expectedTableName);
    }
  });
});
