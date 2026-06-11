import type { OnApplicationShutdown } from '@nestjs/common';

import { Global, Inject, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Logger } from 'nestjs-pino';
import { Pool } from 'pg';

import type { Env } from '../app/env.schema';

import { ENV } from '../app/env.schema';
import { DRIZZLE, PG_POOL } from './database.constants';

const CONNECTION_TIMEOUT_MS = 2000;
const QUERY_TIMEOUT_MS = 5000;
const STATEMENT_TIMEOUT_MS = 5000;

const createPool = (env: Env, logger: Logger): Pool => {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  });
  pool.on('error', (err) => {
    logger.error({ err }, 'PostgreSQL pool error');
  });
  return pool;
};

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV, Logger],
      useFactory: createPool,
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  private isPoolEnded = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.isPoolEnded) {
      return;
    }
    this.isPoolEnded = true;
    await this.pool.end();
  }
}
