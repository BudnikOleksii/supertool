import { z } from 'zod';

const MIN_PORT = 1;
const MAX_PORT = 65_535;
const DEFAULT_PORT = 3001;
const MIN_OPERATOR_PASSWORD_LENGTH = 8;
const DEFAULT_OPERATOR_EMAIL = 'operator@supertool.local';
const DEFAULT_OPERATOR_NAME = 'Operator';

export const ENV = Symbol('ENV');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(MIN_PORT).max(MAX_PORT).default(DEFAULT_PORT),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.url(),
  AUTH_TRUSTED_ORIGINS: z.string().min(1),
  AUTH_RATE_LIMIT_DISABLED: z.enum(['true', 'false']).default('false'),
  SEED_OPERATOR_EMAIL: z.email().default(DEFAULT_OPERATOR_EMAIL),
  SEED_OPERATOR_PASSWORD: z.string().min(MIN_OPERATOR_PASSWORD_LENGTH),
  SEED_OPERATOR_NAME: z.string().min(1).default(DEFAULT_OPERATOR_NAME),
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

  return result.data;
};
