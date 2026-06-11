import { z } from 'zod';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3001;
const LOCAL_COMPOSE_DATABASE_URL = 'postgres://supertool:supertool@localhost:5432/supertool';

export const ENV = Symbol('ENV');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(MIN_PORT).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: z.url().default(LOCAL_COMPOSE_DATABASE_URL),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (result.data.NODE_ENV === 'production' && source['DATABASE_URL'] === undefined) {
    throw new Error(
      'Invalid environment configuration:\n  - DATABASE_URL: must be set explicitly when NODE_ENV=production (no default fallback)',
    );
  }

  return result.data;
};
