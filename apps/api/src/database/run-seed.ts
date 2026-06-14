import { drizzle } from 'drizzle-orm/node-postgres';
import { join } from 'node:path';
import { Pool } from 'pg';
import { pino } from 'pino';

import { parseEnv } from '../app/env.schema';
import { loadSeedData } from './seeds/load-seed-data';
import { seedOperator } from './seeds/seed-operator';
import { seedTransactions } from './seeds/seed-transactions';

interface RunSeedOptions {
  databaseUrl: string;
}

const resolveSeedDataDir = (): string => join(__dirname, 'data');

export const runSeed = async ({ databaseUrl }: RunSeedOptions): Promise<void> => {
  const env = parseEnv();
  const logger = pino();
  const recordList = loadSeedData(resolveSeedDataDir());

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const db = drizzle(pool);
    const operatorId = await seedOperator({ db, env });
    await seedTransactions({ db, userId: operatorId, recordList, logger });
  } finally {
    await pool.end();
  }
};
