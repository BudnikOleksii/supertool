import type { OnApplicationShutdown } from '@nestjs/common';

import { Global, Inject, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Logger } from 'nestjs-pino';
import { Pool } from 'pg';

import type { Env } from '../app/env.schema';

import { ENV } from '../app/env.schema';
import { DRIZZLE, PG_POOL } from './database.constants';

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
          /*
           * Bounded waits so a dead database surfaces as an error (health: 'down')
           * instead of a request that hangs forever.
           */
          connectionTimeoutMillis: 2000,
          query_timeout: 5000,
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
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
