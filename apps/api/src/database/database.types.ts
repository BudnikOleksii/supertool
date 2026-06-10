import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/*
 * Re-parameterize with the schema barrel (`src/database/schemas/`) once the first
 * tables land (Story 1.5: better-auth/users; Story 2.1: transactions).
 */
export type Database = NodePgDatabase;
