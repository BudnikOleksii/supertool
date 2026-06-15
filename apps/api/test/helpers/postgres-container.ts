import type { StartedTestContainer } from 'testcontainers';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';

const POSTGRES_IMAGE = 'postgres:16-alpine';
const CONTAINER_READY_OCCURRENCES = 2;

export const POSTGRES_PORT = 5432;
export const BOOT_TIMEOUT_MS = 180_000;
export const MIGRATIONS_FOLDER = resolve(process.cwd(), 'src/database/migrations');

export const startPostgresContainer = async (): Promise<StartedTestContainer> =>
  new GenericContainer(POSTGRES_IMAGE)
    .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
    .withExposedPorts(POSTGRES_PORT)
    .withWaitStrategy(
      Wait.forLogMessage(
        /database system is ready to accept connections/u,
        CONTAINER_READY_OCCURRENCES,
      ),
    )
    .start();

export const buildDatabaseUrl = (container: StartedTestContainer): string =>
  `postgres://test:test@${container.getHost()}:${container.getMappedPort(POSTGRES_PORT)}/test`;

export const runMigrations = async (databaseUrl: string): Promise<void> => {
  const migrationPool = new Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(migrationPool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await migrationPool.end();
  }
};
