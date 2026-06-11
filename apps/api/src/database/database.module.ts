import type { OnApplicationShutdown } from '@nestjs/common';

import { Global, Inject, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Logger } from 'nestjs-pino';
import { Pool } from 'pg';

import type { Env } from '../app/env.schema';

import { ENV } from '../app/env.schema';
import { DRIZZLE, PG_POOL } from './database.constants';

/*
 * Bounded waits so a dead database surfaces as an error (health: 'down')
 * instead of a request that hangs forever. `query_timeout` is client-side;
 * `statement_timeout` also cancels the statement server-side.
 */
const CONNECTION_TIMEOUT_MS = 2000;
const QUERY_TIMEOUT_MS = 5000;
const STATEMENT_TIMEOUT_MS = 5000;

/**
 * Single owner of the PostgreSQL connection (architecture data boundary):
 * no other app or package may ever hold a DB connection.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV, Logger],
      useFactory: (env: Env, logger: Logger) => {
        const pool = new Pool({
          connectionString: env.DATABASE_URL,
          connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
          query_timeout: QUERY_TIMEOUT_MS,
          statement_timeout: STATEMENT_TIMEOUT_MS,
        });
        /*
         * Idle clients emit 'error' when the server drops the connection; without
         * a listener that single event would crash the whole process.
         */
        pool.on('error', (err) => {
          logger.error({ err }, 'PostgreSQL pool error');
        });
        return pool;
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      // Domain schema tables arrive with Story 1.5 (better-auth/users) and 2.1 (transactions).
      useFactory: (pool: Pool) => drizzle(pool),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  private isPoolEnded = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    // The pg Pool rejects a second end() call — guard against repeated shutdown hooks.
    if (this.isPoolEnded) {
      return;
    }
    this.isPoolEnded = true;
    await this.pool.end();
  }
}
