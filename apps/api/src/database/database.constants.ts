/** Injection token for the pg connection pool — owned exclusively by apps/api (data boundary). */
export const PG_POOL = Symbol('PG_POOL');

/** Injection token for the Drizzle database instance — repositories are its only consumers (D7). */
export const DRIZZLE = Symbol('DRIZZLE');
