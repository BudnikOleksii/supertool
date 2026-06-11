import { z } from 'zod';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3001;

/** Nest injection token for the validated environment object. */
export const ENV = Symbol('ENV');

/**
 * Per-app zod-validated env schema (architecture: Infrastructure & Deployment).
 * Defaults match docker/docker-compose.yml so the native dev loop and CI builds
 * work without a .env file; any explicitly set but invalid value fails the boot.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(MIN_PORT).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: z.url().default('postgres://supertool:supertool@localhost:5432/supertool'),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates the environment; throws a readable, key-naming error on failure (no partial boot). */
export const parseEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  /*
   * The local-compose default carries hardcoded credentials — production must
   * never silently fall back to it.
   */
  if (result.data.NODE_ENV === 'production' && source['DATABASE_URL'] === undefined) {
    throw new Error(
      'Invalid environment configuration:\n  - DATABASE_URL: must be set explicitly when NODE_ENV=production (no default fallback)',
    );
  }

  return result.data;
};
