import { runMigrations } from './run-migrations';
import { runSeed } from './run-seed';

interface PrepareDatabaseOptions {
  databaseUrl: string;
  migrationsFolder: string;
}

export const prepareDatabase = async ({
  databaseUrl,
  migrationsFolder,
}: PrepareDatabaseOptions): Promise<void> => {
  await runMigrations({ databaseUrl, migrationsFolder });
  await runSeed({ databaseUrl });
};
